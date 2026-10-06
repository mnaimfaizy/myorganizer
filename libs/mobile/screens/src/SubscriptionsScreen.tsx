import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  newRecordId,
  draftSheetBusy,
  useUnconfirmedEdit,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  putVaultRecord,
  type CurrencyCode,
  type SubscriptionRecord,
} from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Button,
  EmptyState,
  Icon,
  InlineNotice,
  ListRow,
  ListSection,
  OfflineBanner,
  Screen,
  SegmentedControl,
  StatusPill,
  Text,
  useFocusRing,
  useLargeTitleCollapse,
  usePressFeedback,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import {
  BILLING_CYCLE_UNITS,
  calculateVisibleMonthlyEquivalents,
  countActiveSubscriptions,
  describeRenewal,
  describeRowSubtitle,
  formatSubscriptionAmount,
  hasVisibleSubscriptions,
  monthlyEquivalentExamples,
  selectSubscriptionListView,
  subscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  type DecryptedSubscription,
  type SubscriptionListFilter,
} from './subscriptionModel';
import {
  SubscriptionNewSheet,
  type NewSubscriptionValues,
} from './SubscriptionNewSheet';
import {
  SUBSCRIPTIONS_ROUTES,
  type SubscriptionsStackParamList,
} from './subscriptionsStack';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

const FILTER_SEGMENTS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
] as const satisfies readonly {
  value: SubscriptionListFilter;
  label: string;
}[];

/**
 * Each filter tab's own section title and empty state. The Active tab's
 * section says how it is ordered (Sub-List: "Active · by next billing date ·
 * 4"); the rest are named for their status (Sub-List-Cancelled: "Cancelled ·
 * 2"). Only Expired's empty state is drawn (Sub-List-Expired); the other
 * three follow its shape.
 */
const FILTER_COPY = {
  active: {
    section: 'Active · by next billing date',
    emptyTitle: 'Nothing active',
    emptyDescription: 'Subscriptions marked Active show here.',
  },
  inactive: {
    section: 'Inactive',
    emptyTitle: 'Nothing inactive',
    emptyDescription: 'Subscriptions marked Inactive show here.',
  },
  cancelled: {
    section: 'Cancelled',
    emptyTitle: 'Nothing cancelled',
    emptyDescription: 'Subscriptions marked Cancelled show here.',
  },
  expired: {
    section: 'Expired',
    emptyTitle: 'Nothing expired',
    emptyDescription: 'Subscriptions marked Expired show here.',
  },
} as const satisfies Record<
  SubscriptionListFilter,
  { section: string; emptyTitle: string; emptyDescription: string }
>;

/** The Cancelled tab's footnote (Sub-List-Cancelled), verbatim. */
const CANCELLED_FOOTNOTE =
  'Cancelled Subscriptions don’t count toward the Monthly Equivalent.';

/**
 * The Subscriptions tab (Sub-List): the Monthly Equivalent card and then the
 * filter, Renewing soon and the rest by next billing date on Active, one
 * section per other status, and "Add subscription" pinned above the tab bar.
 * New Subscription is the one create path here; Edit, status transitions,
 * and Mark cancelled live on the detail screen.
 */
export function SubscriptionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SubscriptionsStackParamList>>();
  const rememberedScroll = useRememberedScroll('Subscriptions');
  const titleCollapse = useLargeTitleCollapse();
  const {
    snapshot,
    loading,
    refreshing,
    loadError,
    writeError,
    reload,
    discard,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Subscriptions);

  const [filter, setFilter] = useState<SubscriptionListFilter>('active');
  const [newVisible, setNewVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);

  const records = snapshot?.envelope.records;
  const hasAny = useMemo(() => hasVisibleSubscriptions(records), [records]);

  const view = useMemo(
    () => selectSubscriptionListView(records, filter, new Date()),
    [records, filter],
  );

  // The card reads the Active tab whichever tab is showing, so it never
  // changes under the User while they look at another filter.
  const activeView = useMemo(
    () => selectSubscriptionListView(records, 'active', new Date()),
    [records],
  );
  const activeSubscriptions = useMemo(
    () => [...activeView.renewingSoon, ...activeView.items],
    [activeView],
  );
  const monthlyEquivalents = useMemo(
    () => calculateVisibleMonthlyEquivalents(activeSubscriptions),
    [activeSubscriptions],
  );

  const {
    pendingId: pendingSubscriptionId,
    revertedId: revertedSubscriptionId,
    push,
    reloadAfterConflict,
  } = useUnconfirmedEdit(apply, retry, reload);

  const newBusy = draftSheetBusy({
    pendingId: pendingSubscriptionId,
    refreshing,
  });

  const openNew = useCallback((): void => setNewVisible(true), []);

  const createSubscription = useCallback(
    (values: NewSubscriptionValues): void => {
      const now = new Date().toISOString();
      const subscription: SubscriptionRecord = {
        id: newRecordId(),
        name: values.name,
        startDate: now,
        status: 'active',
        billingCycle: values.billingCycle,
        amount: values.amount,
        currency: values.currency,
        paymentMethod: 'creditCard',
        renewalType: 'autoRenew',
        tier: 'basic',
        updatedAt: now,
        ...(values.nextBillingDate != null
          ? { nextBillingDate: values.nextBillingDate }
          : {}),
      };
      void push(subscription.id, (envelope) =>
        putVaultRecord(envelope, subscription),
      ).then((confirmed) => {
        if (confirmed) setNewVisible(false);
      });
    },
    [push],
  );

  // Cancelling abandons the draft, including one whose push was refused: it
  // is dropped here so a later reload does not create it behind the User.
  // Not while the sheet is busy (`draftSheetBusy`).
  const cancelNew = useCallback((): void => {
    if (newBusy) return;
    discard();
    setNewVisible(false);
  }, [newBusy, discard]);

  // A reload after a conflict sends the refused New Subscription. Once it is
  // on the server the sheet closes, as it does after a confirmed create — a
  // draft left up would be created a second time.
  const reloadNewAfterConflict = useCallback((): void => {
    void reloadAfterConflict().then((sent) => {
      if (sent) setNewVisible(false);
    });
  }, [reloadAfterConflict]);

  const openDetail = useCallback(
    (subscriptionId: string): void => {
      navigation.navigate(SUBSCRIPTIONS_ROUTES.detail, { subscriptionId });
    },
    [navigation],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      rememberedScroll.onScroll(event);
      titleCollapse.onScroll(event);
    },
    [rememberedScroll, titleCollapse],
  );

  // A New Subscription whose push was refused never reaches the list — the
  // record is not in the copy the screen shows — so its reason is shown in
  // the New sheet, which stays up with the User's draft.
  const newError =
    newVisible && writeError != null && revertedSubscriptionId != null
      ? VAULT_WRITE_ERROR_COPY[writeError]
      : null;

  const rowState = (id: string): ListRowState =>
    pendingSubscriptionId === id ? 'unconfirmed' : 'normal';

  const renderRow = (
    subscription: DecryptedSubscription,
  ): React.JSX.Element => (
    <SubscriptionRow
      key={subscription.id}
      subscription={subscription}
      state={rowState(subscription.id)}
      onPress={() => openDetail(subscription.id)}
    />
  );

  const listed = view.renewingSoon.length + view.items.length;

  return (
    <Screen edges={TAB_SCREEN_EDGES} noPadding>
      <TabScreenHeader
        title="Subscriptions"
        collapsed={titleCollapse.collapsed}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View
          style={[
            styles.centered,
            { gap: theme.spacing.md, padding: theme.spacing.md },
          ]}
        >
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'your subscriptions')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: theme.spacing.md },
            ]}
            showsVerticalScrollIndicator={false}
            contentOffset={rememberedScroll.contentOffset}
            onScroll={onScroll}
            scrollEventThrottle={rememberedScroll.scrollEventThrottle}
          >
            <OfflineBanner />

            {!hasAny ? (
              <View style={[styles.centered, { padding: theme.spacing.lg }]}>
                <EmptyState
                  icon="subscriptions"
                  title="No Subscriptions yet"
                  description="Add the ones you pay for and see what they cost each month."
                />
              </View>
            ) : (
              <>
                {filter === 'active' && monthlyEquivalents.length > 0 && (
                  <View
                    style={{
                      paddingHorizontal: theme.spacing.md,
                      paddingBottom: theme.spacing.md,
                    }}
                  >
                    <MonthlyEquivalentCard
                      totals={monthlyEquivalents}
                      activeCount={countActiveSubscriptions(
                        activeSubscriptions,
                      )}
                      onPress={() => setExplainerVisible(true)}
                    />
                  </View>
                )}

                <View
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingBottom: theme.spacing.md,
                  }}
                >
                  <SegmentedControl
                    segments={FILTER_SEGMENTS}
                    value={filter}
                    onChange={setFilter}
                    accessibilityLabel="Filter subscriptions"
                  />
                </View>

                {listed === 0 ? (
                  <View
                    style={[styles.centered, { padding: theme.spacing.lg }]}
                  >
                    <EmptyState
                      title={FILTER_COPY[filter].emptyTitle}
                      description={FILTER_COPY[filter].emptyDescription}
                    />
                  </View>
                ) : (
                  <View style={{ gap: theme.spacing.sm }}>
                    {view.renewingSoon.length > 0 && (
                      <ListSection title="Renewing soon · next 7 days">
                        {view.renewingSoon.map(renderRow)}
                      </ListSection>
                    )}
                    {view.items.length > 0 && (
                      <ListSection
                        title={FILTER_COPY[filter].section}
                        count={view.items.length}
                      >
                        {view.items.map(renderRow)}
                      </ListSection>
                    )}
                    {filter === 'cancelled' && (
                      <Text
                        variant="caption"
                        style={{
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: theme.spacing.sm,
                        }}
                      >
                        {CANCELLED_FOOTNOTE}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                // The sheet pads the bar 12 top and bottom — between two
                // steps, so it takes `md`.
                padding: theme.spacing.md,
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            <Button label="Add subscription" icon="plus" onPress={openNew} />
          </View>
        </>
      )}

      <SubscriptionNewSheet
        visible={newVisible}
        busy={newVisible && newBusy}
        errorMessage={newError?.message}
        errorActionLabel={
          writeError === 'conflict' ? newError?.action : undefined
        }
        onErrorAction={reloadNewAfterConflict}
        onCreate={createSubscription}
        onCancel={cancelNew}
      />

      <MonthlyEquivalentExplainer
        visible={explainerVisible}
        subscriptions={activeSubscriptions}
        onDismiss={() => setExplainerVisible(false)}
      />
    </Screen>
  );
}

/**
 * One Subscription on the list (Sub-List): the name at 600, what renews when
 * with its pills inline, and the amount over its cycle on the right. A
 * Cancelled one is muted — it no longer counts (Sub-List-Cancelled).
 */
function SubscriptionRow({
  subscription,
  state,
  onPress,
}: {
  subscription: DecryptedSubscription;
  state: ListRowState;
  onPress: () => void;
}): React.JSX.Element {
  const now = new Date();
  const status = subscriptionStatus(subscription);
  const counting = status === 'active' || status === 'pending';
  const title = subscription.name ?? 'Untitled subscription';
  const subtitle = counting
    ? describeRenewal(subscription, now)
    : describeRowSubtitle(subscription, now);
  const manual = counting && subscription.renewalType === 'manual';
  const pills: string[] = [];
  if (!counting) pills.push(SUBSCRIPTION_STATUS_LABELS[status]);
  if (status === 'pending') pills.push(SUBSCRIPTION_STATUS_LABELS.pending);
  if (manual) pills.push('Manual');

  const amount =
    subscription.amount != null && subscription.currency != null
      ? formatSubscriptionAmount(subscription.amount, subscription.currency)
      : null;
  const unit =
    subscription.billingCycle != null
      ? BILLING_CYCLE_UNITS[subscription.billingCycle]
      : null;
  const muted = status === 'cancelled';

  return (
    <ListRow
      title={title}
      titleWeight="semibold"
      muted={muted}
      subtitle={subtitle}
      subtitleAccessory={
        pills.length === 0 ? undefined : (
          <>
            {!counting && (
              <StatusPill label={SUBSCRIPTION_STATUS_LABELS[status]} />
            )}
            {status === 'pending' && (
              <StatusPill label={SUBSCRIPTION_STATUS_LABELS.pending} />
            )}
            {manual && <StatusPill label="Manual" tone="warning" />}
          </>
        )
      }
      accessibilityLabel={[title, subtitle, ...pills, amount, unit]
        .filter((part): part is string => part != null)
        .join(', ')}
      trailing={
        amount == null ? undefined : (
          <View style={styles.amount}>
            <Text
              variant="body"
              weight="semibold"
              color={muted ? 'mutedForeground' : 'foreground'}
              style={styles.figures}
              numberOfLines={1}
            >
              {amount}
            </Text>
            {unit != null && <Text variant="caption">{unit}</Text>}
          </View>
        )
      }
      chevron
      onPress={onPress}
      state={state}
    />
  );
}

/**
 * The Monthly Equivalent card (Sub-List): one "≈ A$176.30 / month" per
 * currency side by side, never converted, and what it counts. The whole card
 * is the way into the explainer.
 */
function MonthlyEquivalentCard({
  totals,
  activeCount,
  onPress,
}: {
  totals: Array<{ currency: CurrencyCode; amount: number }>;
  activeCount: number;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing();
  const amounts = totals.map(({ currency, amount }) =>
    formatSubscriptionAmount(amount, currency),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Monthly Equivalent: ${amounts
        .map((amount) => `about ${amount}`)
        .join(' and ')} a month. What is this?`}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={press.android_ripple}
      style={({ pressed }) => [
        styles.card,
        {
          gap: theme.spacing.sm,
          // The sheet pads the card 14 × 16: `md` both ways.
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        theme.shadows.card,
        press.pressedStyle(pressed),
        focus.ringStyle,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text variant="labelCaps">Monthly Equivalent</Text>
        <Icon name="info" size={18} color="mutedForeground" />
      </View>
      <View style={[styles.cardAmounts, { columnGap: theme.spacing.md }]}>
        {amounts.map((amount) => (
          // The sheet sets the figure at 22/28 — between `title` and
          // `title-lg`; it takes `title`, whose weight and face are drawn.
          <Text key={amount} variant="title" style={styles.figures}>
            {`≈ ${amount} `}
            <Text variant="bodySm" weight="medium" color="mutedForeground">
              / month
            </Text>
          </Text>
        ))}
      </View>
      <Text variant="caption">
        {`${activeCount} active · each currency on its own line, never converted`}
      </Text>
    </Pressable>
  );
}

/**
 * What the Monthly Equivalent is (Sub-List-Explainer): how a cycle becomes a
 * month, that currencies never mix, and the sum worked for every counted
 * Subscription that is not already monthly.
 */
function MonthlyEquivalentExplainer({
  visible,
  subscriptions,
  onDismiss,
}: {
  visible: boolean;
  subscriptions: readonly DecryptedSubscription[];
  onDismiss: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const examples = useMemo(
    () => monthlyEquivalentExamples(subscriptions),
    [subscriptions],
  );

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Monthly Equivalent"
      footer={<Button label="Got it" onPress={onDismiss} />}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySm">
          Each active Subscription restated as a monthly cost, whatever its
          cycle: a yearly charge ÷ 12, a weekly one × 52 ÷ 12.
        </Text>
        <Text variant="bodySm">
          Each currency is totalled on its own. Nothing is converted, so A$ and
          US$ never mix.
        </Text>
      </View>
      {examples.length > 0 && (
        <View
          style={[styles.examples, { borderTopColor: theme.colors.border }]}
        >
          {examples.map((example) => (
            <View
              key={example.id}
              accessible
              style={[
                styles.example,
                {
                  gap: theme.spacing.md,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Text
                variant="bodySm"
                style={[styles.exampleLabel, styles.figures]}
                numberOfLines={2}
              >
                {example.label}
              </Text>
              <Text variant="bodySm" weight="semibold" style={styles.figures}>
                {example.equivalent}
              </Text>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

/** A worked example's row height on the explainer. */
const EXAMPLE_ROW_HEIGHT = 44;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  amount: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  examples: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  example: {
    minHeight: EXAMPLE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exampleLabel: {
    flexShrink: 1,
  },
});
