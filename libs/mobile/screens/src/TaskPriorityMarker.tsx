import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TaskPriority } from '@myorganizer/vault-core/portable';
import { useTheme } from '@myorganizer/mobile/ui';
import { priorityBarCount } from './taskModel';

export interface TaskPriorityMarkerProps {
  priority: TaskPriority | undefined;
}

/** The three bars' heights, rising left to right, as the Tasks sheet draws them. */
const BAR_HEIGHTS = [5, 8, 11] as const;

/**
 * A Task's priority as a bar-count marker: filled bars out of three, drawn
 * inline before the title (Tasks sheet).
 *
 * High fills all three in `foreground`; Medium and Low fill two and one in
 * `muted-foreground` (#908) — so High stands out by colour as well as by
 * count. The empty bars are `muted-foreground` at 30%. Never a destructive
 * colour: this says how urgent a Task is, where the app's one destructive
 * colour says something is about to be removed, and the two must never look
 * like the same claim.
 *
 * Decorative: the row it sits in carries the priority in its accessible
 * label already, so nothing here repeats it for a screen reader.
 */
export function TaskPriorityMarker({
  priority,
}: TaskPriorityMarkerProps): React.JSX.Element {
  const theme = useTheme();
  const filled = priorityBarCount(priority);
  const fill =
    priority === 'high'
      ? theme.colors.foreground
      : theme.colors.mutedForeground;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <View
          key={height}
          style={[
            styles.bar,
            { height },
            index < filled
              ? { backgroundColor: fill }
              : [
                  styles.empty,
                  { backgroundColor: theme.colors.mutedForeground },
                ],
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // 14 × 12, the bars 3 wide and 2 apart — the sheet's own sizes. No spacing
  // token is below 4, and the marker is a glyph rather than a layout.
  row: {
    width: 14,
    height: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 3,
    // The sheet rounds each bar at 1; the radius scale starts at 4, which
    // would draw a 3-wide bar as a capsule.
    borderRadius: 1,
  },
  empty: {
    opacity: 0.3,
  },
});
