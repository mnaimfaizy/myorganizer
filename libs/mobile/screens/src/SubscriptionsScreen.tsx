import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  newRecordId,
  usePendingVaultEdit,
  useVaultBlob,
  useVaultSession,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  putVaultRecord,
  type SubscriptionBillingCycle,
  type SubscriptionRecord,
} from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Button,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  ListRow,
  ListSection,
  LockAction,
  OfflineBanner,
  Screen,
  SegmentedControl,
  StatusPill,
  Text,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import {
  describeRenewal,
  formatSubscriptionAmount,
  calculateVisibleMonthlyEquivalents,
  selectSubscriptionListView,
  subscriptionStatus,
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

const FILTER_LABEL = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
  expired: 'Expired',
} as const satisfies Record<SubscriptionListFilter, string>;

const BILLING_CYCLE_LABELS = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  twoYears: 'Every 2 years',
  threeYears: 'Every 3 years',
} as const satisfies Record<SubscriptionBillingCycle, string>;

/** What a List row shows beside the name: amount, cycle, then "renews in n
 * days" — the exact three-part meta the slice's List spec asks for. */
function describeSubscriptionMeta(
  subscription: DecryptedSubscription,
  now: Date,
): string {
  const parts: string[] = [];
  if (subscription.amount != null && subscription.currency != null) {
    parts.push(
      formatSubscriptionAmount(subscription.amount, subscription.currency),
    );
  }
  if (subscription.billingCycle != null) {
    parts.push(BILLING_CYCLE_LABELS[subscription.billingCycle]);
  }
  parts.push(describeRenewal(subscription, now));
  return parts.join(' · ');
}

/**
 * The Subscriptions tab: the Monthly Equivalent card and Renewing soon on
 * Active only, then every matching Subscription by next billing date —
 * Pending shown under Active with its own pill, no date sorting last, manual
 * renewal flagged. New Subscription is the one create path here; Edit,
 * status transitions, and Mark cancelled live on the detail screen.
 */
export function SubscriptionsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SubscriptionsStackParamList>>();
  const { lock } = useVaultSession();
  const rememberedScroll = useRememberedScroll('Subscriptions');
  const { snapshot, loading, loadError, writeError, reload, apply, retry } =
    useVaultBlob(VaultBlobType.Subscriptions);

  const [filter, setFilter] = useState<SubscriptionListFilter>('active');
  const [newVisible, setNewVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);

  const view = useMemo(
    () =>
      selectSubscriptionListView(
        snapshot?.envelope.records,
        filter,
        new Date(),
      ),
    [snapshot, filter],
  );

  const monthlyEquivalents = useMemo(
    () =>
      filter === 'active'
        ? calculateVisibleMonthlyEquivalents([
            ...view.renewingSoon,
            ...view.items,
          ])
        : [],
    [filter, view],
  );

  const {
    pendingId: pendingSubscriptionId,
    revertedId: revertedSubscriptionId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = usePendingVaultEdit(apply, retry, reload);

  const openNew = useCallback((): void => setNewVisible(true), []);

  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') return;
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerActions, { gap: theme.spacing.xs }]}>
          <IconButton
            icon="plus"
            accessibilityLabel="New Subscription"
            onPress={openNew}
          />
          <LockAction onPress={() => lock('manual')} />
        </View>
      ),
    });
  }, [navigation, openNew, lock, theme.spacing.xs]);

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

  const cancelNew = useCallback((): void => {
    if (pendingSubscriptionId !== null) return;
    setNewVisible(false);
  }, [pendingSubscriptionId]);

  const openDetail = useCallback(
    (subscriptionId: string): void => {
      navigation.navigate(SUBSCRIPTIONS_ROUTES.detail, { subscriptionId });
    },
    [navigation],
  );

  const rowState = (id: string): ListRowState =>
    pendingSubscriptionId === id
      ? 'unconfirmed'
      : revertedSubscriptionId === id && writeError != null
        ? 'reverted'
        : 'normal';

  const renderRow = (
    subscription: DecryptedSubscription,
  ): React.JSX.Element => {
    const notice =
      writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
    const status = subscriptionStatus(subscription);
    const title = subscription.name ?? 'Untitled subscription';

    return (
      <ListRow
        key={subscription.id}
        title={title}
        subtitle={describeSubscriptionMeta(subscription, new Date())}
        onPress={() => openDetail(subscription.id)}
        trailing={
          <View style={[styles.trailingRow, { gap: theme.spacing.xs }]}>
            {status === 'pending' && <StatusPill label="Pending" />}
            {subscription.renewalType === 'manual' && (
              <StatusPill label="Manual" />
            )}
            <Icon name="chevronRight" size={20} color="mutedForeground" />
          </View>
        }
        state={rowState(subscription.id)}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={
          writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit
        }
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    );
  };

  const nothingToShow =
    view.renewingSoon.length === 0 && view.items.length === 0;

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader
        title="Subscriptions"
        trailing={
          <IconButton
            icon="plus"
            accessibilityLabel="New Subscription"
            onPress={openNew}
          />
        }
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
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
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            {
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              paddingBottom: theme.spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          {...rememberedScroll}
        >
          <OfflineBanner />

          <SegmentedControl
            segments={FILTER_SEGMENTS}
            value={filter}
            onChange={setFilter}
            accessibilityLabel="Filter subscriptions"
          />

          {writeError != null && revertedSubscriptionId != null && (
            <InlineNotice
              tone="destructive"
              message={VAULT_WRITE_ERROR_COPY[writeError].message}
              actionLabel={VAULT_WRITE_ERROR_COPY[writeError].action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterConflict()
                  : retryFailedEdit())
              }
            />
          )}

          {filter === 'active' && (
            <View
              style={[
                styles.card,
                {
                  gap: theme.spacing.sm,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  padding: theme.spacing.md,
                },
              ]}
            >
              <View style={[styles.cardHeader, { gap: theme.spacing.xs }]}>
                <Text variant="labelCaps" color="mutedForeground">
                  Monthly Equivalent
                </Text>
                <IconButton
                  icon="info"
                  accessibilityLabel="What is Monthly Equivalent?"
                  onPress={() => setExplainerVisible(true)}
                />
              </View>
              {monthlyEquivalents.length === 0 ? (
                <Text variant="bodySm" color="mutedForeground">
                  No active subscriptions.
                </Text>
              ) : (
                monthlyEquivalents.map(({ currency, amount }) => (
                  <Text key={currency} variant="title">
                    {formatSubscriptionAmount(amount, currency)} / mo
                  </Text>
                ))
              )}
            </View>
          )}

          {nothingToShow && (
            <EmptyState
              icon="subscriptions"
              title="No subscriptions yet"
              description="Add one below, or on the web."
            />
          )}

          {view.renewingSoon.length > 0 && (
            <ListSection
              title="Renewing soon"
              meta={`${view.renewingSoon.length}`}
              style={{ gap: theme.spacing.sm }}
            >
              {view.renewingSoon.map(renderRow)}
            </ListSection>
          )}

          {view.items.length > 0 && (
            <ListSection
              title={FILTER_LABEL[filter]}
              meta={`${view.items.length}`}
              style={{ gap: theme.spacing.sm }}
            >
              {view.items.map(renderRow)}
            </ListSection>
          )}
        </ScrollView>
      )}

      <SubscriptionNewSheet
        visible={newVisible}
        busy={newVisible && pendingSubscriptionId !== null}
        onCreate={createSubscription}
        onCancel={cancelNew}
      />

      <BottomSheet
        visible={explainerVisible}
        onDismiss={() => setExplainerVisible(false)}
        title="Monthly Equivalent"
      >
        <Text variant="body" color="mutedForeground">
          Each Active subscription&apos;s amount restated as what it costs per
          month, whatever its billing cycle — weekly, yearly, or anything
          between. It stays in each subscription&apos;s own currency and never
          converts money. Pending subscriptions are not included.
        </Text>
        <Button label="Got it" onPress={() => setExplainerVisible(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  row: {
    overflow: 'hidden',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
