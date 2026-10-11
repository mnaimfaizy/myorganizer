import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type {
  CurrencyCode,
  SubscriptionBillingCycle,
} from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Chip,
  Icon,
  InlineNotice,
  MenuSheet,
  Text,
  TextField,
  useFocusRing,
  usePressFeedback,
  useTheme,
} from '@myorganizer/mobile/ui';
import { DateField } from './DateField';
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_ORDER,
  CURRENCY_NAMES,
  CURRENCY_ORDER,
  currencyPrefix,
  NAME_ERROR,
  parseAmountDraft,
} from './subscriptionModel';

/** The New sheet's footnote (Sub-New): what the short form leaves to defaults. */
const DEFAULTS_NOTE =
  'Starts today · Basic tier · Credit card · Auto-renew. Change these on the web.';

/** The Currency picker's own footnote (Sub-New-Currency). */
const CURRENCY_NOTE =
  'Stays in this currency. Monthly Equivalents are never converted.';

/** The currency button's width and height on Sub-New. */
const CURRENCY_BUTTON = { width: 104, height: 48 } as const;

export interface NewSubscriptionValues {
  name: string;
  amount: number;
  currency: CurrencyCode;
  billingCycle: SubscriptionBillingCycle;
  nextBillingDate?: string;
}

export interface SubscriptionNewSheetProps {
  visible: boolean;
  /** The create is in flight: Add turns into a spinner. */
  busy: boolean;
  /** Why the last Add was not saved — shown above the form, which keeps the draft. */
  errorMessage?: string;
  /** Offered beside that reason — "Reload" after a conflict. */
  errorActionLabel?: string;
  onErrorAction?: () => void;
  onCreate: (values: NewSubscriptionValues) => void;
  onCancel: () => void;
}

/**
 * New Subscription (Sub-New): name, amount and currency, cycle, next billing
 * date. Every other field defaults — start date, tier, payment method,
 * renewal type — and the footnote says so. A form sheet with Cancel / New
 * subscription / Add; what is wrong is said under the field on Add
 * (Sub-New-Errors), never by a dimmed Add with no reason.
 */
export function SubscriptionNewSheet({
  visible,
  busy,
  errorMessage,
  errorActionLabel,
  onErrorAction,
  onCreate,
  onCancel,
}: SubscriptionNewSheetProps): React.JSX.Element {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('AUD');
  const [billingCycle, setBillingCycle] =
    useState<SubscriptionBillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Re-seeds every time the sheet opens, so a New Subscription started twice
  // never shows the first attempt's leftover draft.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setName('');
    setAmountText('');
    setCurrency('AUD');
    setBillingCycle('monthly');
    setNextBillingDate(null);
    setShowErrors(false);
    setCurrencyOpen(false);
  } else if (!visible && wasVisible) {
    setWasVisible(false);
  }

  const trimmedName = name.trim();
  const amount = parseAmountDraft(amountText);
  const nameError =
    showErrors && trimmedName.length === 0 ? NAME_ERROR : undefined;
  const amountError = showErrors && !amount.ok ? amount.error : undefined;

  const submit = (): void => {
    if (busy) return;
    if (trimmedName.length === 0 || !amount.ok) {
      setShowErrors(true);
      return;
    }
    onCreate({
      name: trimmedName,
      amount: amount.amount,
      currency,
      billingCycle,
      nextBillingDate: nextBillingDate ?? undefined,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onCancel}
      title="New subscription"
      navBar={{
        actionLabel: 'Add',
        onAction: submit,
        actionBusy: busy,
      }}
    >
      {errorMessage != null && (
        <InlineNotice
          tone="destructive"
          message={errorMessage}
          actionLabel={errorActionLabel}
          onAction={onErrorAction}
        />
      )}
      <TextField
        label="Name"
        placeholder="e.g. Netflix"
        value={name}
        onChangeText={setName}
        error={nameError}
        editable={!busy}
        autoFocus
        returnKeyType="next"
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySm" weight="semibold" color="foreground">
          Amount and currency
        </Text>
        <View style={[styles.amountRow, { gap: theme.spacing.sm }]}>
          <CurrencyButton
            currency={currency}
            disabled={busy}
            onPress={() => setCurrencyOpen(true)}
          />
          <TextField
            accessibilityLabel={`Amount in ${currency}`}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
            error={amountError}
            editable={!busy}
            containerStyle={styles.amountField}
          />
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="bodySm" weight="semibold" color="foreground">
          Billing cycle
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Billing cycle"
          style={[styles.chipRow, { gap: theme.spacing.sm }]}
        >
          {BILLING_CYCLE_ORDER.map((cycle) => (
            <Chip
              key={cycle}
              label={BILLING_CYCLE_LABELS[cycle]}
              icon="tag"
              accessibilityRole="radio"
              selected={billingCycle === cycle}
              disabled={busy}
              onPress={() => setBillingCycle(cycle)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <DateField
          label="Next billing date"
          value={nextBillingDate}
          onChange={setNextBillingDate}
          clearable
          clearLabel="Clear next billing date"
          disabled={busy}
        />
        <Text variant="caption">{DEFAULTS_NOTE}</Text>
      </View>

      {/* Rendered inside the form sheet so it stacks over it: a second
          top-level Modal would not present above the first on iOS. */}
      <MenuSheet
        visible={currencyOpen}
        onDismiss={() => setCurrencyOpen(false)}
        title="Currency"
        footnote={CURRENCY_NOTE}
        items={CURRENCY_ORDER.map((code) => ({
          id: code,
          label: `${code} · ${CURRENCY_NAMES[code]} · ${currencyPrefix(code)}`,
          selected: currency === code,
          onPress: () => setCurrency(code),
        }))}
      />
    </BottomSheet>
  );
}

/**
 * The currency half of "Amount and currency" (Sub-New): the code and a
 * chevron in a field-edged button that opens the Currency picker.
 */
function CurrencyButton({
  currency,
  disabled,
  onPress,
}: {
  currency: CurrencyCode;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Currency, ${currency}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={focus.ripple(press.android_ripple)}
      style={({ pressed }) => [
        styles.currency,
        CURRENCY_BUTTON,
        {
          // The sheet pads it 14 leading, 10 trailing: `md` and `sm`.
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.sm,
          borderRadius: theme.radii.md,
          borderColor: theme.colors.controlEdge,
          backgroundColor: disabled ? theme.colors.muted : theme.colors.card,
        },
        press.pressedStyle(pressed),
        focus.ringStyle,
      ]}
    >
      <Text variant="body" weight="semibold">
        {currency}
      </Text>
      <Icon name="chevronDown" size={18} color="mutedForeground" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  amountField: {
    flex: 1,
  },
  currency: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
});
