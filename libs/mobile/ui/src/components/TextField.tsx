import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET, TEXT_SCALE_CAP } from '../metrics';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { Glyph } from './glyphs';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** The field's height on the Inputs sheet. No token carries a control height. */
const FIELD_HEIGHT = 48;

/** How many lines a multiline field shows before it grows. */
const MULTILINE_ROWS = 2;

export interface TextFieldProps extends TextInputProps {
  /** Sentence case, above the field. Also what the input is announced as. */
  label?: string;
  /**
   * What is wrong with the value, in one line. Replaces the hint, thickens
   * the edge to 2pt of `errorEdge`, and is announced when it appears.
   */
  error?: string;
  /** How to fill the field in, when that is not obvious from the label. */
  hint?: string;
  /**
   * Fixed text inside the field before the value — a currency ("A$") on an
   * amount. Read after the label, before the value.
   */
  prefix?: string;
  /**
   * Fixed text inside the field after the value — a unit ("minutes" on a
   * Task's estimate). Read after the value.
   */
  suffix?: string;
  /**
   * Drawn at the far end of the label's line — an Unconfirmed Edit's
   * "Saving…" beside the field it is saving (Tasks · Detail · Saving).
   */
  labelAccessory?: React.ReactNode;
  /**
   * A glyph inside the field before the value — the Add sheet's magnifier on
   * "Search your Catalog". Decorative: the label or placeholder says what the
   * field is for.
   */
  icon?: IconName;
  containerStyle?: ViewStyle;
  /**
   * Renders the reveal toggle — a 44 × 44 eye inside the field's trailing
   * edge — which then owns `secureTextEntry` instead of the caller.
   */
  revealable?: boolean;
  /**
   * The noun the reveal toggle's accessibility label names — 'Show
   * password' / 'Hide password' by default. A field holding the Vault
   * secret passes 'passphrase', never leaving the default: 'passphrase' and
   * 'password' name two different secrets (CONTEXT.md), and a shared default
   * would otherwise call the Vault secret a password on every screen that
   * reveals it.
   */
  revealLabel?: string;
  /**
   * Renders a clear (×) accessory while the field holds a value. Not shown on
   * a revealable field, whose trailing edge is the reveal toggle.
   */
  onClear?: () => void;
  /** The clear accessory's label. Defaults to "Clear <label>". */
  clearLabel?: string;
}

export function TextField({
  label,
  error,
  hint,
  prefix,
  suffix,
  labelAccessory,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  maxFontSizeMultiplier = TEXT_SCALE_CAP,
  revealable = false,
  revealLabel = 'password',
  onClear,
  clearLabel,
  secureTextEntry,
  multiline,
  editable,
  value,
  ...rest
}: TextFieldProps): React.JSX.Element {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const disabled = editable === false;
  const hasError = error != null;
  const showClear =
    !revealable && onClear != null && value != null && value.length > 0;
  const hasTrailing = revealable || showClear;

  // Focus and error both thicken the edge to 2pt (Inputs sheet); an error
  // wins over focus, so the field stays marked while the User corrects it.
  const edgeWidth = hasError || focused ? 2 : 1;
  const edgeColor = hasError
    ? theme.colors.errorEdge
    : focused
      ? theme.colors.focus
      : theme.colors.controlEdge;
  // The sheet pads the value 14 from the edge — the nearer step is `md` — and
  // takes the extra edge point back out of the padding, so the value does not
  // shift when the field takes focus.
  const leadingPadding = theme.spacing.md - (edgeWidth - 1);

  return (
    <View
      style={[
        { gap: theme.spacing.sm },
        disabled && styles.disabled,
        containerStyle,
      ]}
    >
      {label != null &&
        (labelAccessory == null ? (
          <Text variant="bodySm" weight="semibold" color="foreground">
            {label}
          </Text>
        ) : (
          <View style={[styles.labelRow, { gap: theme.spacing.sm }]}>
            <Text variant="bodySm" weight="semibold" color="foreground">
              {label}
            </Text>
            {labelAccessory}
          </View>
        ))}
      <View
        style={[
          styles.field,
          {
            minHeight: Math.max(FIELD_HEIGHT, MIN_TOUCH_TARGET),
            borderWidth: edgeWidth,
            borderColor: edgeColor,
            borderRadius: theme.radii.md,
            paddingLeft: leadingPadding,
            // A trailing accessory is its own 44pt target and sits flush with
            // the edge instead of being padded in from it.
            paddingRight: hasTrailing ? 0 : leadingPadding,
            gap: theme.spacing.sm,
            backgroundColor: disabled ? theme.colors.muted : theme.colors.card,
          },
          multiline && {
            alignItems: 'flex-start',
            paddingVertical: theme.spacing.sm,
          },
        ]}
      >
        {icon != null && (
          <View
            testID="text-field-icon"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name={icon} size={20} color="foreground" />
          </View>
        )}
        {prefix != null && (
          <Text
            variant="body"
            color="mutedForeground"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {prefix}
          </Text>
        )}
        <TextInput
          accessibilityLabel={
            label != null && prefix != null ? `${label}, ${prefix}` : label
          }
          accessibilityState={{ disabled }}
          accessibilityHint={hasError ? error : undefined}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          secureTextEntry={revealable ? !revealed : secureTextEntry}
          multiline={multiline}
          editable={editable}
          value={value}
          style={[
            styles.input,
            theme.type.body,
            {
              minHeight: multiline
                ? theme.type.body.lineHeight * MULTILINE_ROWS
                : MIN_TOUCH_TARGET,
              color: theme.colors.foreground,
            },
            multiline && styles.multiline,
            style,
          ]}
          placeholderTextColor={theme.colors.mutedForeground}
          selectionColor={theme.colors.foreground}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {suffix != null && (
          <Text
            variant="bodySm"
            color="mutedForeground"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {suffix}
          </Text>
        )}
        {revealable && (
          <Accessory
            label={revealed ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
            onPress={() => setRevealed((current) => !current)}
          >
            <Glyph
              name={revealed ? 'eyeOff' : 'eye'}
              size={20}
              color="mutedForeground"
            />
          </Accessory>
        )}
        {showClear && (
          <Accessory
            label={clearLabel ?? `Clear ${label?.toLowerCase() ?? 'field'}`}
            onPress={onClear}
          >
            <Icon name="close" size={20} color="mutedForeground" />
          </Accessory>
        )}
      </View>
      {hint != null && !hasError && <Text variant="caption">{hint}</Text>}
      {hasError && (
        // The glyph and the line are one accessibility element, announced as
        // an alert: a View carrying only a role is not an element on iOS.
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.error, { gap: theme.spacing.sm }]}
        >
          <Icon name="warning" size={14} color="errorEdge" />
          <Text
            variant="caption"
            weight="medium"
            color="errorText"
            style={styles.errorText}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * A 44 × 44 icon button inside the field's trailing edge — the reveal toggle
 * or the clear accessory. Borderless ripple on Android (Platform sheet).
 */
function Accessory({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback('borderless');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={feedback.android_ripple}
      style={({ pressed }) => [
        styles.accessory,
        {
          minHeight: MIN_TOUCH_TARGET,
          minWidth: MIN_TOUCH_TARGET,
          borderRadius: theme.radii.full,
        },
        feedback.pressedStyle(pressed),
      ]}
    >
      {children}
    </Pressable>
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
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  multiline: {
    textAlignVertical: 'top',
  },
  accessory: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.4,
  },
});
