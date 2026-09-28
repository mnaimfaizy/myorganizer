import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { Text } from './Text';

export interface ProgressMeterProps {
  /** How far along, from 0 to 1. Values outside that range are clamped. */
  value: number;
  /** What is progressing. Also what the meter is announced as. */
  label?: string;
  /** The count beside the label — "4 of 12". */
  meta?: string;
  style?: ViewStyle;
}

/**
 * How far through something is.
 *
 * The percentage is announced rather than drawn, through
 * `accessibilityValue`: a bar is the one thing on a screen that a screen
 * reader cannot read out of the layout, so the number has to be given to it.
 */
export function ProgressMeter({
  value,
  label,
  meta,
  style,
}: ProgressMeterProps): React.JSX.Element {
  const theme = useTheme();
  const fraction = Math.min(Math.max(value, 0), 1);

  return (
    <View style={[{ gap: theme.spacing.xs }, style]}>
      {(label != null || meta != null) && (
        <View style={styles.labels}>
          {label != null && (
            <Text variant="bodySm" style={styles.label}>
              {label}
            </Text>
          )}
          {meta != null && <Text variant="caption">{meta}</Text>}
        </View>
      )}
      <View
        // `accessible` is what makes the role and the value real: a View
        // carrying only a role is not an accessibility element on iOS, so the
        // percentage below would never be announced. The bar holds nothing
        // interactive, so grouping it costs nothing.
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(fraction * 100),
        }}
        style={[
          styles.track,
          {
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.muted,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${fraction * 100}%`,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.brand,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexShrink: 1,
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
