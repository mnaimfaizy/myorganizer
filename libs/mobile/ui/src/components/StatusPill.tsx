import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';
import { Text } from './Text';

/** What a status says about the thing it is attached to. */
export type StatusTone = 'neutral' | 'success' | 'warning' | 'destructive';

/**
 * What each tone is made of, named by Semantic Role so one table serves both
 * colour modes. Pinned to the tone set.
 */
const TONES = {
  neutral: { fill: 'muted', text: 'mutedForeground' },
  success: { fill: 'success', text: 'successForeground' },
  warning: { fill: 'warning', text: 'warningForeground' },
  destructive: { fill: 'destructive', text: 'destructiveForeground' },
} as const satisfies Record<
  StatusTone,
  { fill: keyof ThemeColors; text: keyof ThemeColors }
>;

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  style?: ViewStyle;
}

/**
 * A state, not a control. It never takes a press and never carries an action:
 * a pill that can be tapped is a Chip, and the two look close enough that
 * making one of them do both would leave the User guessing which they have.
 */
export function StatusPill({
  label,
  tone = 'neutral',
  style,
}: StatusPillProps): React.JSX.Element {
  const theme = useTheme();
  const { fill, text } = TONES[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors[fill],
        },
        style,
      ]}
    >
      <Text variant="caption" color={text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
  },
});
