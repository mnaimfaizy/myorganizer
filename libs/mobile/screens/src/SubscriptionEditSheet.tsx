import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SubscriptionStatus } from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Button,
  Chip,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  subscriptionStatus,
  type DecryptedSubscription,
} from './subscriptionModel';

// Pinned to the status set (ADR 0053): a status added to the enum and not
// here fails to compile, rather than silently missing a chip.
const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
  expired: 'Expired',
  pending: 'Pending',
} as const satisfies Record<SubscriptionStatus, string>;

const STATUS_CHIPS = (Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map(
  (value) => ({ value, label: STATUS_LABELS[value] }),
);

/** `date`'s own calendar day as `YYYY-MM-DD`, in local time — the Mark
 * cancelled sheet's default cancellation date. */
function todayDateOnly(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SubscriptionEditValues {
  status: SubscriptionStatus;
  amount: number;
  nextBillingDate?: string;
  cancellationDate?: string;
  cancellationReason?: string;
}

export interface SubscriptionEditSheetProps {
  visible: boolean;
  busy: boolean;
  subscription: DecryptedSubscription | null;
  onSave: (values: SubscriptionEditValues) => void;
  onCancel: () => void;
}

/**
 * Edit: status, next billing date, amount — one Save, one Vault Push.
 * Choosing Cancelled does not offer Save directly: it opens the Mark
 * cancelled step (date, optional reason) instead, so a Subscription cannot
 * become Cancelled without a cancellation date. Both steps commit through
 * the same `onSave`, so the caller still makes exactly one Vault Push either
 * way.
 */
export function SubscriptionEditSheet({
  visible,
  busy,
  subscription,
  onSave,
  onCancel,
}: SubscriptionEditSheetProps): React.JSX.Element {
  const theme = useTheme();

  const [step, setStep] = useState<'edit' | 'cancel'>('edit');
  const [seededId, setSeededId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<SubscriptionStatus>('active');
  const [amountDraft, setAmountDraft] = useState('');
  const [nextBillingDateDraft, setNextBillingDateDraft] = useState('');
  const [cancellationDateDraft, setCancellationDateDraft] = useState('');
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState('');

  // Re-seeds once per Subscription id while the sheet is open, and forgets
  // the seed on close — the same shape `TaskDetailScreen` uses for a Task,
  // adapted so a background reload while the sheet is open never clobbers
  // what the User is mid-typing, and reopening the same Subscription later
  // starts from its current state rather than a stale draft.
  if (visible && subscription !== null && subscription.id !== seededId) {
    setSeededId(subscription.id);
    setStatusDraft(subscriptionStatus(subscription));
    setAmountDraft(
      subscription.amount != null ? String(subscription.amount) : '',
    );
    setNextBillingDateDraft(subscription.nextBillingDate ?? '');
    // Seeded from the Subscription's own cancellation fields, not blanked —
    // a Subscription already Cancelled carries a real date, and `saveEdit`
    // below falls back to the Mark cancelled step using exactly this seed
    // rather than an empty one, so re-saving an already-Cancelled
    // Subscription without touching its status can never blank the date it
    // already carries.
    setCancellationDateDraft(subscription.cancellationDate ?? '');
    setCancellationReasonDraft(subscription.cancellationReason ?? '');
    setStep('edit');
  } else if (!visible && seededId !== null) {
    setSeededId(null);
  }

  const parsedAmount = Number(amountDraft.trim());
  const amountValid =
    amountDraft.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 0;

  const selectStatus = (value: SubscriptionStatus): void => {
    if (value === 'cancelled') {
      setCancellationDateDraft(todayDateOnly());
      setCancellationReasonDraft('');
      setStep('cancel');
    } else {
      setStatusDraft(value);
    }
  };

  const saveEdit = (): void => {
    // The seed above can hand this step a Subscription that is already
    // Cancelled — its status chip never re-fires `selectStatus` in that
    // case, so Save has to make the same check `selectStatus` makes for a
    // fresh choice: Cancelled never saves without going through the date
    // step first, however it got here.
    if (statusDraft === 'cancelled') {
      setStep('cancel');
      return;
    }
    if (!amountValid) return;
    onSave({
      status: statusDraft,
      amount: parsedAmount,
      nextBillingDate:
        nextBillingDateDraft.trim().length > 0
          ? nextBillingDateDraft.trim()
          : undefined,
    });
  };

  const saveCancelled = (): void => {
    if (!amountValid || cancellationDateDraft.trim().length === 0) return;
    onSave({
      status: 'cancelled',
      amount: parsedAmount,
      nextBillingDate:
        nextBillingDateDraft.trim().length > 0
          ? nextBillingDateDraft.trim()
          : undefined,
      cancellationDate: cancellationDateDraft.trim(),
      cancellationReason:
        cancellationReasonDraft.trim().length > 0
          ? cancellationReasonDraft.trim()
          : undefined,
    });
  };

  const backToEdit = (): void => {
    if (busy) return;
    setStep('edit');
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onCancel}
      title={step === 'edit' ? 'Edit subscription' : 'Mark cancelled'}
    >
      {step === 'edit' ? (
        <>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="labelCaps" color="mutedForeground">
              Status
            </Text>
            <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
              {STATUS_CHIPS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  selected={statusDraft === entry.value}
                  onPress={() => selectStatus(entry.value)}
                />
              ))}
            </View>
          </View>
          <TextField
            label="Next billing date"
            placeholder="YYYY-MM-DD"
            value={nextBillingDateDraft}
            onChangeText={setNextBillingDateDraft}
            editable={!busy}
          />
          <TextField
            label="Amount"
            keyboardType="decimal-pad"
            value={amountDraft}
            onChangeText={setAmountDraft}
            editable={!busy}
          />
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <Button
              label="Save"
              busy={busy}
              disabled={!amountValid}
              onPress={saveEdit}
            />
            <Button
              label="Cancel"
              variant="ghost"
              disabled={busy}
              onPress={onCancel}
            />
          </View>
        </>
      ) : (
        <>
          <Text variant="body" color="mutedForeground">
            Cancelled always carries a date it was cancelled on.
          </Text>
          <TextField
            label="Cancellation date"
            placeholder="YYYY-MM-DD"
            value={cancellationDateDraft}
            onChangeText={setCancellationDateDraft}
            editable={!busy}
          />
          <TextField
            label="Reason (optional)"
            value={cancellationReasonDraft}
            onChangeText={setCancellationReasonDraft}
            editable={!busy}
            multiline
          />
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <Button
              label="Save"
              busy={busy}
              disabled={
                !amountValid || cancellationDateDraft.trim().length === 0
              }
              onPress={saveCancelled}
            />
            <Button
              label="Back"
              variant="ghost"
              disabled={busy}
              onPress={backToEdit}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'column',
  },
});
