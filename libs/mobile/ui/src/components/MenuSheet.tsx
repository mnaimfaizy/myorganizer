import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import type { ThemeColors } from '../theme';
import { BottomSheet } from './BottomSheet';
import { useFocusRing } from '../hooks/useFocusRing';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** A menu row's height on the Groceries and Account sheets. */
const ROW_HEIGHT = 56;

export interface MenuSheetItem {
  /** Stable within the sheet. */
  id: string;
  label: string;
  icon?: IconName;
  /**
   * Renders the label and glyph in red. `errorEdge` rather than `destructive`
   * for the colour: `destructive` is a fill, and in dark it is a deep red that
   * reads at about 2:1 as text on the raised sheet.
   */
  destructive?: boolean;
  /**
   * Makes the row a choice: a check marks the one that is on. With it the row
   * is announced as a radio (a picker — Auto-lock) unless `role` says it is a
   * switch (a setting — "Keep screen on").
   */
  selected?: boolean;
  /** How a choice row is announced. Ignored on an action row. */
  role?: 'radio' | 'switch';
  /** Trailing text in the quiet colour — a setting's current value, "On". */
  value?: string;
  /**
   * Leaves the sheet up after the press — a setting toggled in place. By
   * default a row dismisses the sheet before it runs.
   */
  keepOpen?: boolean;
  onPress: () => void;
}

export interface MenuSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The thing the menu is about — the list's name, the setting's name. */
  title?: string;
  /** One line above the rows, for a picker whose choices need framing. */
  lead?: string;
  /** One line below the rows — what the choice does and does not do. */
  footnote?: string;
  items: readonly MenuSheetItem[];
}

/**
 * The one shape every "⋯" overflow menu and every short picker in the app
 * takes — a list of named rows, each dismissing the sheet before it runs
 * unless it is a setting flipped in place. Where `ConfirmSheet` is the app's
 * one "are you sure", this is its one "which one": neither is the other with
 * different labels, because a menu item that itself needed confirming opens a
 * `ConfirmSheet` of its own once this one closes rather than growing a second
 * button per row here.
 */
export function MenuSheet({
  visible,
  onDismiss,
  title,
  lead,
  footnote,
  items,
}: MenuSheetProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      {lead != null && (
        <Text variant="bodySm" color="foreground">
          {lead}
        </Text>
      )}
      <View
        accessibilityRole={
          items.some(
            (item) => item.selected !== undefined && item.role !== 'switch',
          )
            ? 'radiogroup'
            : undefined
        }
        style={[styles.list, { borderTopColor: theme.colors.border }]}
      >
        {items.map((item, index) => (
          <MenuRow
            key={item.id}
            item={item}
            // The last row keeps its rule only when a footnote follows it.
            last={index === items.length - 1 && footnote == null}
            onDismiss={onDismiss}
          />
        ))}
      </View>
      {footnote != null && (
        <Text variant="caption" color="foreground">
          {footnote}
        </Text>
      )}
    </BottomSheet>
  );
}

function MenuRow({
  item,
  last,
  onDismiss,
}: {
  item: MenuSheetItem;
  last: boolean;
  onDismiss: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback();
  const focus = useFocusRing('inset');
  const color: keyof ThemeColors = item.destructive
    ? 'errorEdge'
    : 'foreground';
  const choice = item.selected !== undefined;
  const role = choice ? (item.role ?? 'radio') : 'button';

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={
        item.value != null ? `${item.label}, ${item.value}` : item.label
      }
      accessibilityState={choice ? { checked: item.selected } : undefined}
      onPress={() => {
        if (item.keepOpen !== true) onDismiss();
        item.onPress();
      }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={focus.ripple(feedback.android_ripple)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: Math.max(ROW_HEIGHT, MIN_TOUCH_TARGET),
          // The sheet draws a 14pt glyph gap, which rounds to `md`.
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.xs,
          borderBottomColor: theme.colors.border,
        },
        last && styles.lastRow,
        feedback.pressedStyle(pressed),
        focus.ringStyle,
      ]}
    >
      {item.icon != null && <Icon name={item.icon} size={22} color={color} />}
      <View style={styles.label}>
        <Text variant="body" color={color}>
          {item.label}
        </Text>
      </View>
      {item.value != null && (
        <Text variant="bodySm" color="mutedForeground">
          {item.value}
        </Text>
      )}
      {item.selected === true && (
        <Icon name="check" size={20} color="foreground" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  label: {
    flex: 1,
  },
});
