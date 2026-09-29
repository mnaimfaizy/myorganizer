import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  usePendingVaultEdit,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  putVaultRecord,
  type SubscriptionBillingCycle,
  type SubscriptionPaymentMethod,
  type SubscriptionRecord,
  type SubscriptionRenewalType,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  EmptyState,
  InlineNotice,
  ListSection,
  OfflineBanner,
  Screen,
  StatusPill,
  Text,
  useTheme,
  type StatusTone,
} from '@myorganizer/mobile/ui';
import {
  formatSubscriptionAmount,
  findVisibleSubscription,
  subscriptionStatus,
} from './subscriptionModel';
import {
  SubscriptionEditSheet,
  type SubscriptionEditValues,
} from './SubscriptionEditSheet';
import {
  SUBSCRIPTIONS_ROUTES,
  type SubscriptionsStackParamList,
} from './subscriptionsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';

const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
  expired: 'Expired',
  pending: 'Pending',
} as const satisfies Record<SubscriptionStatus, string>;

const STATUS_TONE = {
  active: 'success',
  pending: 'neutral',
  inactive: 'neutral',
  cancelled: 'destructive',
  expired: 'warning',
} as const satisfies Record<SubscriptionStatus, StatusTone>;

const BILLING_CYCLE_LABELS = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  twoYears: 'Every 2 years',
  threeYears: 'Every 3 years',
} as const satisfies Record<SubscriptionBillingCycle, string>;

const PAYMENT_METHOD_LABELS = {
  creditCard: 'Credit Card',
  paypal: 'PayPal',
  bankTransfer: 'Bank Transfer',
} as const satisfies Record<SubscriptionPaymentMethod, string>;

const RENEWAL_TYPE_LABELS = {
  autoRenew: 'Auto renew',
  manual: 'Manual',
} as const satisfies Record<SubscriptionRenewalType, string>;

const TIER_LABELS = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
  individual: 'Individual',
  family: 'Family',
} as const satisfies Record<SubscriptionTier, string>;

/** `value`'s date-only portion, or the placeholder when there is none. */
function dateOnly(value: string | undefined): string {
  return value != null ? value.slice(0, 10) : '—';
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="labelCaps" color="mutedForeground">
        {label}
      </Text>
      {typeof value === 'string' ? <Text variant="body">{value}</Text> : value}
    </View>
  );
}

/**
 * One Subscription's detail: every field, grouped. The link — when present —
 * opens the system browser rather than an in-app view, since nothing here
 * renders web content. Edit lives behind a sheet; Delete and full editing
 * stay web-only for this slice.
 */
export function SubscriptionDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        SubscriptionsStackParamList,
        typeof SUBSCRIPTIONS_ROUTES.detail
      >
    >();
  const { subscriptionId } =
    useRoute<
      RouteProp<SubscriptionsStackParamList, typeof SUBSCRIPTIONS_ROUTES.detail>
    >().params;

  const {
    snapshot,
    loading,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Subscriptions);

  const subscription = useMemo(
    () => findVisibleSubscription(snapshot?.envelope.records, subscriptionId),
    [snapshot, subscriptionId],
  );

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    usePendingVaultEdit(apply, retry, reload);

  const [editVisible, setEditVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: subscription?.name ?? 'Subscription' });
  }, [navigation, subscription?.name]);

  const commitEdit = useCallback(
    (values: SubscriptionEditValues): void => {
      if (subscription === null) return;
      const now = new Date().toISOString();
      const next: SubscriptionRecord = {
        ...(subscription as SubscriptionRecord),
        status: values.status,
        amount: values.amount,
        updatedAt: now,
      };
      if (values.nextBillingDate != null) {
        next.nextBillingDate = values.nextBillingDate;
      } else {
        delete next.nextBillingDate;
      }
      if (values.status === 'cancelled') {
        next.cancellationDate = values.cancellationDate;
        if (values.cancellationReason != null) {
          next.cancellationReason = values.cancellationReason;
        } else {
          delete next.cancellationReason;
        }
      }
      void push(subscription.id, (envelope) =>
        putVaultRecord(envelope, next),
      ).then((confirmed) => {
        if (confirmed) setEditVisible(false);
      });
    },
    [subscription, push],
  );

  const cancelEdit = useCallback((): void => {
    if (pendingId !== null) return;
    setEditVisible(false);
  }, [pendingId]);

  const openLink = useCallback((): void => {
    if (subscription?.link != null) void Linking.openURL(subscription.link);
  }, [subscription?.link]);

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
  const reverted =
    subscription !== null &&
    revertedId === subscription.id &&
    writeError != null;

  const status = subscription != null ? subscriptionStatus(subscription) : null;

  return (
    <Screen edges={STACK_SCREEN_EDGES}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'this subscription')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : subscription === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon="subscriptions"
            title="Subscription not found"
            description="It may have been deleted on another device."
          />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            { gap: theme.spacing.lg, padding: theme.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <OfflineBanner />

          {reverted && notice != null && (
            <InlineNotice
              tone="destructive"
              message={notice.message}
              actionLabel={notice.action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterConflict()
                  : retryFailedEdit())
              }
            />
          )}

          <ListSection title="Overview" style={{ gap: theme.spacing.md }}>
            <FieldRow label="Name" value={subscription.name ?? '—'} />
            <FieldRow
              label="Status"
              value={
                status != null ? (
                  <StatusPill
                    label={STATUS_LABELS[status]}
                    tone={STATUS_TONE[status]}
                  />
                ) : (
                  '—'
                )
              }
            />
            <FieldRow
              label="Tier"
              value={
                subscription.tier != null ? TIER_LABELS[subscription.tier] : '—'
              }
            />
          </ListSection>

          <ListSection title="Billing" style={{ gap: theme.spacing.md }}>
            <FieldRow
              label="Amount"
              value={
                subscription.amount != null && subscription.currency != null
                  ? formatSubscriptionAmount(
                      subscription.amount,
                      subscription.currency,
                    )
                  : '—'
              }
            />
            <FieldRow
              label="Billing cycle"
              value={
                subscription.billingCycle != null
                  ? BILLING_CYCLE_LABELS[subscription.billingCycle]
                  : '—'
              }
            />
            <FieldRow
              label="Next billing date"
              value={dateOnly(subscription.nextBillingDate)}
            />
            <FieldRow
              label="Renewal type"
              value={
                subscription.renewalType != null
                  ? RENEWAL_TYPE_LABELS[subscription.renewalType]
                  : '—'
              }
            />
            <FieldRow
              label="Payment method"
              value={
                subscription.paymentMethod != null
                  ? PAYMENT_METHOD_LABELS[subscription.paymentMethod]
                  : '—'
              }
            />
          </ListSection>

          <ListSection title="Dates" style={{ gap: theme.spacing.md }}>
            <FieldRow
              label="Start date"
              value={dateOnly(subscription.startDate)}
            />
            <FieldRow label="End date" value={dateOnly(subscription.endDate)} />
            {status === 'cancelled' && (
              <>
                <FieldRow
                  label="Cancellation date"
                  value={dateOnly(subscription.cancellationDate)}
                />
                <FieldRow
                  label="Cancellation reason"
                  value={subscription.cancellationReason ?? '—'}
                />
              </>
            )}
          </ListSection>

          {subscription.link != null && subscription.link.length > 0 && (
            <Button label="Open link" variant="secondary" onPress={openLink} />
          )}

          <Button
            label="Edit"
            onPress={() => setEditVisible(true)}
            disabled={writing}
          />
        </ScrollView>
      )}

      <SubscriptionEditSheet
        visible={editVisible}
        busy={subscription !== null && pendingId === subscription.id}
        subscription={subscription}
        onSave={commitEdit}
        onCancel={cancelEdit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
