import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import {
  BottomSheet,
  Button,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  usePressFeedback,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  formatCalendarDate,
  parseCalendarDate,
  toCalendarDate,
} from './calendarDate';

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
}: DateFieldProps): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback('bounded');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const current = value != null ? parseCalendarDate(value) : null;
  const hasError = error != null;

  const open = (): void => {
    const start = current ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start,
        mode: 'date',
        minimumDate,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked != null) {
            onChange(toCalendarDate(picked));
          }
        },
      });
      return;
    }
    setDraft(start);
    setSheetOpen(true);
  };

  return (
    <View style={[{ gap: theme.spacing.sm }, disabled && styles.disabled]}>
      <Text variant="bodySm" weight="semibold" color="foreground">
        {label}
      </Text>
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
          android_ripple={feedback.android_ripple}
          style={({ pressed }) => [
            styles.value,
            {
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.md,
            },
            feedback.pressedStyle(pressed),
          ]}
        >
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
            style={[
              styles.clear,
              { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET },
            ]}
          >
            <Icon name="close" size={20} color="mutedForeground" />
          </Pressable>
        )}
      </View>
      {hasError && (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.error, { gap: theme.spacing.sm }]}
        >
          <Icon name="warning" size={14} color="errorEdge" />
          <Text variant="caption" weight="medium" color="errorText">
            {error}
          </Text>
        </View>
      )}

      {Platform.OS === 'ios' && (
        <BottomSheet
          visible={sheetOpen}
          onDismiss={() => setSheetOpen(false)}
          title={label}
        >
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            accentColor={theme.colors.primary}
            themeVariant={theme.mode}
            onChange={(_event, picked) => {
              if (picked != null) setDraft(picked);
            }}
          />
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            {clearable && (
              <View style={styles.action}>
                <Button
                  label="Clear date"
                  variant="secondary"
                  onPress={() => {
                    onChange(null);
                    setSheetOpen(false);
                  }}
                />
              </View>
            )}
            <View style={styles.action}>
              <Button
                label="Done"
                onPress={() => {
                  onChange(toCalendarDate(draft));
                  setSheetOpen(false);
                }}
              />
            </View>
          </View>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    flex: 1,
    justifyContent: 'center',
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
