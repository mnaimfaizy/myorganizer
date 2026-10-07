import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  staticElement,
  useFocusRing,
  usePressFeedback,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  formatCalendarDate,
  parseCalendarDate,
  toCalendarDate,
} from './calendarDate';
import { InlineDatePicker, openDialogDatePicker } from './platformDatePicker';

/** The field's height, matching TextField on the Inputs sheet. */
const FIELD_HEIGHT = 48;

export interface DateFieldProps {
  /** Sentence case, above the field — "Due date", "Next billing date". */
  label: string;
  /** The stored `YYYY-MM-DD`, or `null` for no date. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown in place of a date — "Choose a date". */
  placeholder?: string;
  /** Renders a clear (×) accessory while a date is set. */
  clearable?: boolean;
  /** The clear accessory's label. Defaults to "Clear <label>". */
  clearLabel?: string;
  /** What is wrong with the value, in one line. */
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  /**
   * Drawn at the far end of the label's line — an Unconfirmed Edit's
   * "Saving…" beside the date it is saving (Tasks · Detail · Saving).
   */
  labelAccessory?: React.ReactNode;
}

export interface CalendarDatePickerOptions {
  /** The iOS sheet's title — the field's label, "Due date". */
  title: string;
  onChange: (value: string | null) => void;
  /** Offers "Clear date" beside "Done" in the iOS sheet. */
  clearable?: boolean;
  minimumDate?: Date;
  /** Called once the picker has gone, whichever way it was closed. */
  onClose?: () => void;
}

export interface CalendarDatePicker {
  /** Opens the platform picker on `value`, or on today when there is none. */
  open: (value: string | null) => void;
  /** The iOS sheet. Render it once; it is `null` on Android. */
  sheet: React.ReactNode;
}

/**
 * The platform's own date picker without a field in front of it — for a
 * control that is not a field, such as the Tasks composer's "Pick date" chip.
 * On iOS the system inline calendar in a sheet with "Clear date" and "Done";
 * on Android the Material date dialog. `DateField` is built on it.
 */
export function useCalendarDatePicker({
  title,
  onChange,
  clearable = false,
  minimumDate,
  onClose,
}: CalendarDatePickerOptions): CalendarDatePicker {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());

  const close = (): void => {
    setSheetOpen(false);
    onClose?.();
  };

  const open = (value: string | null): void => {
    const start =
      (value != null ? parseCalendarDate(value) : null) ?? new Date();
    if (Platform.OS === 'android') {
      openDialogDatePicker({
        value: start,
        minimumDate,
        onPicked: (picked) => onChange(toCalendarDate(picked)),
        onClose,
      });
      return;
    }
    setDraft(start);
    setSheetOpen(true);
  };

  // iOS (and the web preview) pick in a sheet; Android opens a dialog.
  const sheet =
    Platform.OS !== 'android' ? (
      <BottomSheet visible={sheetOpen} onDismiss={close} title={title}>
        <InlineDatePicker
          value={draft}
          minimumDate={minimumDate}
          accentColor={theme.colors.primary}
          mode={theme.mode}
          onChange={setDraft}
        />
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>
          {clearable && (
            <View style={styles.action}>
              <Button
                label="Clear date"
                variant="secondary"
                onPress={() => {
                  onChange(null);
                  close();
                }}
              />
            </View>
          )}
          <View style={styles.action}>
            <Button
              label="Done"
              onPress={() => {
                onChange(toCalendarDate(draft));
                close();
              }}
            />
          </View>
        </View>
      </BottomSheet>
    ) : null;

  return { open, sheet };
}

/**
 * A date the User picks rather than types — the platform's own picker
 * (#908: "Dates use the native platform pickers").
 *
 * On iOS the system inline calendar comes up in a sheet with "Clear date"
 * and "Done" (Tasks · Detail · due date picker); on Android the Material
 * date dialog opens directly (Platform notes). The value in and out is the
 * Vault's `YYYY-MM-DD`, read and written as a local calendar day.
 */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Choose a date',
  clearable = false,
  clearLabel,
  error,
  disabled = false,
  minimumDate,
  labelAccessory,
}: DateFieldProps): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback('bounded');
  // Both sit inside the field's own edge, so each ring is inset.
  const valueFocus = useFocusRing('inset');
  const clearFocus = useFocusRing('inset');
  const picker = useCalendarDatePicker({
    title: label,
    onChange,
    clearable,
    minimumDate,
  });
  const hasError = error != null;
  const open = (): void => picker.open(value);

  return (
    <View style={[{ gap: theme.spacing.sm }, disabled && styles.disabled]}>
      <View style={[styles.labelRow, { gap: theme.spacing.sm }]}>
        <Text variant="bodySm" weight="semibold" color="foreground">
          {label}
        </Text>
        {labelAccessory}
      </View>
      <View
        style={[
          styles.field,
          {
            minHeight: FIELD_HEIGHT,
            borderRadius: theme.radii.md,
            borderWidth: hasError ? 2 : 1,
            borderColor: hasError
              ? theme.colors.errorEdge
              : theme.colors.controlEdge,
            backgroundColor: disabled ? theme.colors.muted : theme.colors.card,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{
            text: value != null ? formatCalendarDate(value) : placeholder,
          }}
          accessibilityHint={hasError ? error : undefined}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={open}
          onFocus={valueFocus.onFocus}
          onBlur={valueFocus.onBlur}
          android_ripple={feedback.android_ripple}
          style={({ pressed }) => [
            styles.value,
            {
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: theme.spacing.md,
              // The sheet sets the glyph 10 from the date: the nearer step.
              gap: theme.spacing.sm,
              borderRadius: theme.radii.md,
            },
            feedback.pressedStyle(pressed),
            valueFocus.ringStyle,
          ]}
        >
          <Icon name="calendar" size={20} color="mutedForeground" />
          <Text
            variant="body"
            color={value != null ? 'foreground' : 'mutedForeground'}
          >
            {value != null ? formatCalendarDate(value) : placeholder}
          </Text>
        </Pressable>
        {clearable && value != null && !disabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel ?? `Clear ${label.toLowerCase()}`}
            onPress={() => onChange(null)}
            onFocus={clearFocus.onFocus}
            onBlur={clearFocus.onBlur}
            style={[
              styles.clear,
              {
                minHeight: MIN_TOUCH_TARGET,
                minWidth: MIN_TOUCH_TARGET,
                borderRadius: theme.radii.md,
              },
              clearFocus.ringStyle,
            ]}
          >
            <Icon name="close" size={20} color="mutedForeground" />
          </Pressable>
        )}
      </View>
      {hasError && (
        <View
          {...staticElement(error)}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.error, { gap: theme.spacing.sm }]}
        >
          <Icon name="warning" size={14} color="errorEdge" />
          <Text
            importantForAccessibility="no"
            variant="caption"
            weight="medium"
            color="errorText"
          >
            {error}
          </Text>
        </View>
      )}

      {picker.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});
