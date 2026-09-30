import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { SubscriptionStatus } from '@myorganizer/vault-core/portable';
import { webAppPath } from '@myorganizer/mobile/feat-auth';
import {
  BottomSheet,
  Button,
  Chip,
  Icon,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import { DateField } from './DateField';
import { toCalendarDate } from './calendarDate';
import {
  currencyPrefix,
  parseAmountDraft,
  subscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_ORDER,
  toPickerDate,
  type DecryptedSubscription,
} from './subscriptionModel';

/** Sub-Edit's note on what this sheet does not edit, verbatim. */
const WEB_ONLY_NOTE =
  'Name, cycle, tier, payment method, renewal type and link are edited on the web.';

/** Where "Open on the web" goes: the web app's Subscriptions page. */
const SUBSCRIPTIONS_ON_THE_WEB = webAppPath('/dashboard/subscriptions');

/** Mark cancelled refuses a cleared date — Cancelled always carries one. */
const CANCELLATION_DATE_ERROR = 'Choose the date it was cancelled';

export interface SubscriptionEditValues {
  status: SubscriptionStatus;
  amount: number;
  nextBillingDate?: string;
  cancellationDate?: string;
  cancellationReason?: string;
}

export interface SubscriptionEditSheetProps {
  visible: boolean;
  /** The save is in flight: Save turns into a spinner. */
  busy: boolean;
  subscription: DecryptedSubscription | null;
  onSave: (values: SubscriptionEditValues) => void;
  onCancel: () => void;
}

/**
 * Edit (Sub-Edit): status, next billing date, amount — one Save, one Vault
 * Push. A full-height form sheet with Cancel / "Edit Netflix" / Save.
 *
 * Cancelled is never saved from here directly: choosing it, or "Mark
 * cancelled", opens the Mark cancelled sheet over this one (Sub-Edit-Cancel)
 * for the date and an optional reason, and that sheet's own "Mark cancelled"
 * is the save — so a Subscription cannot become Cancelled without a
 * cancellation date (#916). Either path is still one `onSave`, one push.
 */
export function SubscriptionEditSheet({
  visible,
  busy,
  subscription,
  onSave,
  onCancel,
}: SubscriptionEditSheetProps): React.JSX.Element {
  const theme = useTheme();

  const [seededId, setSeededId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<SubscriptionStatus>('active');
  const [amountDraft, setAmountDraft] = useState('');
  const [nextBillingDateDraft, setNextBillingDateDraft] = useState<
    string | null
  >(null);
  const [showAmountError, setShowAmountError] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellationDateDraft, setCancellationDateDraft] = useState<
    string | null
  >(null);
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState('');
  const [showCancellationError, setShowCancellationError] = useState(false);

  // Re-seeds once per Subscription id while the sheet is open, and forgets
  // the seed on close — so a background reload while the sheet is open never
  // clobbers what the User is mid-typing, and reopening the same
  // Subscription later starts from its current state rather than a stale
  // draft.
  if (visible && subscription !== null && subscription.id !== seededId) {
    setSeededId(subscription.id);
    setStatusDraft(subscriptionStatus(subscription));
    setAmountDraft(
      subscription.amount != null ? String(subscription.amount) : '',
    );
    setNextBillingDateDraft(toPickerDate(subscription.nextBillingDate));
    setShowAmountError(false);
    setCancelOpen(false);
  } else if (!visible && seededId !== null) {
    setSeededId(null);
  }

  const name = subscription?.name ?? 'subscription';
  const prefix =
    subscription?.currency != null
      ? currencyPrefix(subscription.currency)
      : undefined;
  const amount = parseAmountDraft(amountDraft);
  const amountError = showAmountError && !amount.ok ? amount.error : undefined;
  const cancellationError =
    showCancellationError && cancellationDateDraft == null
      ? CANCELLATION_DATE_ERROR
      : undefined;

  /**
   * Opens Mark cancelled, seeded from the Subscription's own cancellation
   * fields when it already carries them and from today otherwise.
   */
  const openMarkCancelled = (): void => {
    setCancellationDateDraft(
      toPickerDate(subscription?.cancellationDate) ??
        toCalendarDate(new Date()),
    );
    setCancellationReasonDraft(subscription?.cancellationReason ?? '');
    setShowCancellationError(false);
    setCancelOpen(true);
  };

  const selectStatus = (value: SubscriptionStatus): void => {
    if (value === 'cancelled') {
      openMarkCancelled();
      return;
    }
    setStatusDraft(value);
  };

  const save = (): void => {
    if (busy) return;
    // A Subscription seeded Cancelled never had its chip re-pressed, so Save
    // makes the same check the chip does: Cancelled goes through its date.
    if (statusDraft === 'cancelled') {
      openMarkCancelled();
      return;
    }
    if (!amount.ok) {
      setShowAmountError(true);
      return;
    }
    onSave({
      status: statusDraft,
      amount: amount.amount,
      nextBillingDate: nextBillingDateDraft ?? undefined,
    });
  };

  const markCancelled = (): void => {
    if (busy) return;
    if (cancellationDateDraft == null) {
      setShowCancellationError(true);
      return;
    }
    if (!amount.ok) {
      // The amount is on the sheet underneath; say so there.
      setCancelOpen(false);
      setShowAmountError(true);
      return;
    }
    const reason = cancellationReasonDraft.trim();
    setCancelOpen(false);
    onSave({
      status: 'cancelled',
      amount: amount.amount,
      nextBillingDate: nextBillingDateDraft ?? undefined,
      cancellationDate: cancellationDateDraft,
      cancellationReason: reason.length > 0 ? reason : undefined,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onCancel}
      title={`Edit ${name}`}
      navBar={{ actionLabel: 'Save', onAction: save, actionBusy: busy }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySm" weight="semibold" color="foreground">
          Status
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Status"
          style={[styles.chipRow, { gap: theme.spacing.sm }]}
        >
          {SUBSCRIPTION_STATUS_ORDER.map((value) => (
            <Chip
              key={value}
              label={SUBSCRIPTION_STATUS_LABELS[value]}
              icon="tag"
              accessibilityRole="radio"
              selected={statusDraft === value}
              disabled={busy}
              onPress={() => selectStatus(value)}
            />
          ))}
        </View>
      </View>
      <DateField
        label="Next billing date"
        value={nextBillingDateDraft}
        onChange={setNextBillingDateDraft}
        clearable
        clearLabel="Clear next billing date"
        disabled={busy}
      />
      <TextField
        label="Amount"
        prefix={prefix}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amountDraft}
        onChangeText={setAmountDraft}
        error={amountError}
        editable={!busy}
      />
      <View
        style={[
          styles.note,
          {
            gap: theme.spacing.sm,
            // The sheet pads the note 12 × 14 — `md` both ways.
            padding: theme.spacing.md,
            borderRadius: theme.radii.lg,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        <Icon name="info" size={18} color="mutedForeground" />
        <View style={styles.noteBody}>
          <Text variant="bodySm">{WEB_ONLY_NOTE}</Text>
          <Button
            label="Open on the web"
            variant="link"
            size="compact"
            icon="external"
            iconPosition="trailing"
            onPress={() => void Linking.openURL(SUBSCRIPTIONS_ON_THE_WEB)}
            style={styles.link}
          />
        </View>
      </View>
      <Button
        label="Mark cancelled"
        variant="secondary"
        disabled={busy}
        onPress={openMarkCancelled}
      />

      {/* Rendered inside the form sheet so it stacks over it
          (Sub-Edit-Cancel): a second top-level Modal would not present above
          the first on iOS. */}
      <BottomSheet
        visible={visible && cancelOpen}
        onDismiss={() => setCancelOpen(false)}
        title={`Mark ${name} cancelled`}
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label="Mark cancelled"
              busy={busy}
              onPress={markCancelled}
            />
            <Button
              label="Keep active"
              variant="secondary"
              disabled={busy}
              onPress={() => setCancelOpen(false)}
            />
          </View>
        }
      >
        <Text variant="bodySm">
          {`It stops counting toward your Monthly Equivalent. This only records the cancellation — cancel with ${name} too.`}
        </Text>
        <DateField
          label="Cancellation date"
          value={cancellationDateDraft}
          onChange={setCancellationDateDraft}
          clearable
          clearLabel="Clear cancellation date"
          error={cancellationError}
          disabled={busy}
        />
        <TextField
          label="Reason (optional)"
          placeholder="e.g. Not watching enough"
          value={cancellationReasonDraft}
          onChangeText={setCancellationReasonDraft}
          editable={!busy}
          multiline
        />
      </BottomSheet>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteBody: {
    flex: 1,
  },
  // Sub-Edit sets the link flush with the note's text, not padded in.
  link: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
});
