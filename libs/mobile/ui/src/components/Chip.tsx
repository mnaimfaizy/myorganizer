import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  /** A glyph before the label. Decorative — the label is what is announced. */
  icon?: IconName;
  selected?: boolean;
  /** Omitted for a chip that only labels something. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * A short, tappable label — a filter, a tag, a quantity.
 *
 * A chip with no `onPress` renders as plain content rather than as a disabled
 * button, because a screen reader announcing "button, dimmed" for something
 * that was never meant to be pressed is worse than announcing nothing.
 */
export function Chip({
  label,
  icon,
  selected = false,
  onPress,
  accessibilityLabel,
  style,
}: ChipProps): React.JSX.Element {
  const theme = useTheme();
  const foreground = selected ? 'brandForeground' : 'foreground';

  const body = (
    <>
      {icon != null && <Icon name={icon} size={16} color={foreground} />}
      <Text variant="bodySm" color={foreground} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  const shape = [
    styles.chip,
    {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.full,
      borderColor: selected ? theme.colors.brand : theme.colors.border,
      backgroundColor: selected ? theme.colors.brand : theme.colors.card,
    },
    style,
  ];

  if (onPress === undefined) {
    return <View style={shape}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={theme.spacing.sm}
      style={({ pressed }) => [
        ...shape,
        { minHeight: MIN_TOUCH_TARGET - theme.spacing.sm },
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
