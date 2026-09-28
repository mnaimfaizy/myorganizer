import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { haptics } from '../haptics';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * How big the box is. `large` is the grocery trip view's: a shopping list is
 * ticked one-handed, in a supermarket, often at arm's length, and the standard
 * box is the one that gets mis-tapped there.
 */
export type CheckboxSize = 'standard' | 'large';

/** The two box sizes in points, pinned to the size set. */
const BOX = {
  standard: 24,
  large: 28,
} as const satisfies Record<CheckboxSize, number>;

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The label beside the box. Also what the control is announced as. */
  label?: string;
  /** Read out instead of the label, when the label alone is not enough. */
  accessibilityLabel?: string;
  size?: CheckboxSize;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  size = 'standard',
  disabled = false,
  style,
}: CheckboxProps): React.JSX.Element {
  const theme = useTheme();
  const box = BOX[size];

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        // Ticking and unticking feel different on purpose; see `haptics`.
        if (checked) haptics.untick();
        else haptics.tick();
        onChange(!checked);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          gap: theme.spacing.sm,
          minHeight: MIN_TOUCH_TARGET,
          // Both axes, because the box is the whole control when there is no
          // label — which is how a list row uses it. A 24pt box in a row that
          // is only tall enough is a target that meets the floor in one
          // direction and misses it in the other.
          minWidth: MIN_TOUCH_TARGET,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            width: box,
            height: box,
            // The design sheet draws this at 6, which falls exactly between
            // the `sm` and `md` radius steps; a tie rounds up.
            borderRadius: theme.radii.md,
            borderColor: checked
              ? theme.colors.primary
              : theme.colors.controlEdge,
            backgroundColor: checked ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {checked && (
          <Icon name="check" size={box - 6} color="primaryForeground" />
        )}
      </View>
      {label != null && (
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
