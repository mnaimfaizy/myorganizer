import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import type { ThemeColors } from '../theme';
import { Text } from './Text';

/** What a status says about the thing it is attached to. */
export type StatusTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'brand';

/** The pill's height on the Controls sheet. No token carries it. */
const PILL_HEIGHT = 24;

/**
 * What each tone is made of, named by Semantic Role so one table serves both
 * colour modes. Pinned to the tone set.
 *
 * Neutral takes the `secondary` pair (P5): `muted-foreground` on `muted` is
 * 4.09:1 in light, below AA for text this small. In dark the neutral fill is
 * the raised `muted` grey, which sits too close to the background to show its
 * own shape, so it alone carries a `border` edge there.
 */
const TONES = {
  neutral: {
    fill: 'secondary',
    text: 'secondaryForeground',
    darkEdge: 'border',
  },
  success: { fill: 'success', text: 'successForeground', darkEdge: null },
  warning: { fill: 'warning', text: 'warningForeground', darkEdge: null },
  destructive: {
    fill: 'destructive',
    text: 'destructiveForeground',
    darkEdge: null,
  },
  brand: { fill: 'brand', text: 'brandForeground', darkEdge: null },
} as const satisfies Record<
  StatusTone,
  {
    fill: keyof ThemeColors;
    text: keyof ThemeColors;
    darkEdge: keyof ThemeColors | null;
  }
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
 *
 * The label carries the meaning, so colour is never the only cue. It is set in
 * `labelCaps`, whose step carries its own uppercase.
 */
export function StatusPill({
  label,
  tone = 'neutral',
  style,
}: StatusPillProps): React.JSX.Element {
  const theme = useTheme();
  const { fill, text, darkEdge } = TONES[tone];
  const edge = theme.mode === 'dark' ? darkEdge : null;

  return (
    <View
      style={[
        styles.pill,
        {
          minHeight: PILL_HEIGHT,
          // The sheet pads 10 a side, which rounds to `sm`.
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors[fill],
        },
        edge !== null && { borderWidth: 1, borderColor: theme.colors[edge] },
        style,
      ]}
    >
      <Text variant="labelCaps" color={text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
});
