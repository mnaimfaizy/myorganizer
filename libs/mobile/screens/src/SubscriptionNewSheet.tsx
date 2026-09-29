import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  CurrencyCode,
  SubscriptionBillingCycle,
} from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Button,
  Chip,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';

// Both pinned to their enum sets (ADR 0053): a currency or billing cycle
// added to its enum and not here fails to compile, rather than silently
// missing a chip.
const CURRENCY_LABELS = {
  AUD: 'A$ AUD',
  USD: 'US$ USD',
  EUR: '€ EUR',
  GBP: '£ GBP',
  NZD: 'NZ$ NZD',
} as const satisfies Record<CurrencyCode, string>;

const CURRENCY_CHIPS = (Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map(
  (value) => ({ value, label: CURRENCY_LABELS[value] }),
);

const BILLING_CYCLE_LABELS = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  twoYears: 'Every 2 years',
  threeYears: 'Every 3 years',
} as const satisfies Record<SubscriptionBillingCycle, string>;

const BILLING_CYCLE_CHIPS = (
  Object.keys(BILLING_CYCLE_LABELS) as SubscriptionBillingCycle[]
).map((value) => ({ value, label: BILLING_CYCLE_LABELS[value] }));

export interface NewSubscriptionValues {
  name: string;
  amount: number;
  currency: CurrencyCode;
  billingCycle: SubscriptionBillingCycle;
  nextBillingDate?: string;
}

export interface SubscriptionNewSheetProps {
  visible: boolean;
  busy: boolean;
  onCreate: (values: NewSubscriptionValues) => void;
  onCancel: () => void;
}

/**
 * New Subscription: name, amount, currency, cycle, next billing date. Every
 * other field defaults elsewhere — payment method, renewal type, tier,
 * status, and start date are not asked here (CONTEXT.md's slice scope).
 */
export function SubscriptionNewSheet({
  visible,
  busy,
  onCreate,
  onCancel,
}: SubscriptionNewSheetProps): React.JSX.Element {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('AUD');
  const [billingCycle, setBillingCycle] =
    useState<SubscriptionBillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');

  // Re-seeds every time the sheet opens, so a New Subscription started twice
  // never shows the first attempt's leftover draft.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setName('');
    setAmountText('');
    setCurrency('AUD');
    setBillingCycle('monthly');
    setNextBillingDate('');
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const trimmedName = name.trim();
  const parsedAmount = Number(amountText.trim());
  const amountValid =
    amountText.trim().length > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 0;
  const canSave = trimmedName.length > 0 && amountValid;

  const submit = (): void => {
    if (!canSave) return;
    onCreate({
      name: trimmedName,
      amount: parsedAmount,
      currency,
      billingCycle,
      nextBillingDate:
        nextBillingDate.trim().length > 0 ? nextBillingDate.trim() : undefined,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onCancel}
      title="New Subscription"
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        editable={!busy}
        autoFocus
        returnKeyType="next"
      />
      <TextField
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={setAmountText}
        editable={!busy}
      />
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="labelCaps" color="mutedForeground">
          Currency
        </Text>
        <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
          {CURRENCY_CHIPS.map((entry) => (
            <Chip
              key={entry.value}
              label={entry.label}
              selected={currency === entry.value}
              onPress={() => setCurrency(entry.value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="labelCaps" color="mutedForeground">
          Billing cycle
        </Text>
        <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
          {BILLING_CYCLE_CHIPS.map((entry) => (
            <Chip
              key={entry.value}
              label={entry.label}
              selected={billingCycle === entry.value}
              onPress={() => setBillingCycle(entry.value)}
            />
          ))}
        </View>
      </View>
      <TextField
        label="Next billing date"
        placeholder="YYYY-MM-DD"
        value={nextBillingDate}
        onChangeText={setNextBillingDate}
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={[styles.actions, { gap: theme.spacing.sm }]}>
        <Button label="Add" busy={busy} disabled={!canSave} onPress={submit} />
        <Button
          label="Cancel"
          variant="ghost"
          disabled={busy}
          onPress={onCancel}
        />
      </View>
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
