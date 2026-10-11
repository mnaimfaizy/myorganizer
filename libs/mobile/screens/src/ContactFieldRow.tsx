import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  useFocusRing,
  usePressFeedback,
  useTheme,
} from '@myorganizer/mobile/ui';
import type { CopyableField } from './contactModel';

export interface ContactFieldRowProps {
  field: CopyableField;
  onCopy: (field: CopyableField) => void;
}

/**
 * The detail sheets draw a field row at 68 tall, and the headline Mobile
 * Number's at 88. No metric carries either.
 */
const ROW_MIN_HEIGHT = { regular: 68, headline: 88 } as const;

/**
 * One Address or Mobile Number field, as the Details sheets draw it: the
 * whole row is one button that copies the value — a muted label, the value
 * set large, and a trailing copy glyph (Det-Address, Det-Mobile). Every field
 * a Detail screen shows is one of these, so a value never leaves the field it
 * belongs to except through this explicit press — there is no
 * long-press-to-select-text path here to leave unguarded.
 *
 * The sheet sets the value in Inter at 20/28/500 and the headline Mobile
 * Number at 32/40/700; the type scale carries neither. The value takes
 * `title` (20/26, the only 20 pt step) and the headline `display` (34/40) at
 * 700 — the nearest steps, used whole.
 */
export function ContactFieldRow({
  field,
  onCopy,
}: ContactFieldRowProps): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing('inset');
  const headline = field.headline === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${field.label}: ${field.value}`}
      onPress={() => onCopy(field)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={focus.ripple(press.android_ripple)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: headline
            ? ROW_MIN_HEIGHT.headline
            : ROW_MIN_HEIGHT.regular,
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.sm,
          backgroundColor: theme.colors.card,
        },
        press.pressedStyle(pressed),
        focus.ringStyle,
      ]}
    >
      {({ pressed }) => (
        <>
          <View style={styles.labels}>
            <Text variant="caption" color="mutedForeground">
              {field.label}
            </Text>
            <Text
              variant={headline ? 'display' : 'title'}
              weight={headline ? 'bold' : undefined}
              style={field.numeric === true ? styles.figures : undefined}
            >
              {field.value}
            </Text>
          </View>
          <View style={styles.glyph}>
            <Icon
              name="copy"
              size={20}
              color={pressed ? 'foreground' : 'mutedForeground'}
            />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labels: {
    flexShrink: 1,
    flexGrow: 1,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  glyph: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
