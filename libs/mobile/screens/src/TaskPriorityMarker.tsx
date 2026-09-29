import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { TaskPriority } from '@myorganizer/vault-core/portable';
import { useTheme } from '@myorganizer/mobile/ui';
import { priorityBarCount } from './taskModel';

export interface TaskPriorityMarkerProps {
  priority: TaskPriority | undefined;
}

const BAR_COUNT = 3;

/**
 * A Task's priority as bar-count marker: filled bars out of three. Drawn in
 * `primary`, never in a destructive colour — this says how urgent a Task is,
 * where the app's one destructive colour says something is about to be
 * removed, and the two must never look like the same claim.
 *
 * Decorative: the row it sits in carries the priority in its accessible
 * label already, so nothing here repeats it for a screen reader.
 */
export function TaskPriorityMarker({
  priority,
}: TaskPriorityMarkerProps): React.JSX.Element {
  const theme = useTheme();
  const filled = priorityBarCount(priority);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { gap: theme.spacing.xs / 2 }]}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: 6 + index * 3,
              borderRadius: theme.radii.sm,
              backgroundColor:
                index < filled ? theme.colors.primary : theme.colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    width: 4,
  },
});
