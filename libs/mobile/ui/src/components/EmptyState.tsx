import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  /** A glyph in the muted tile above the title. Decorative. */
  icon?: IconName;
  /** What is not here, stated as a fact rather than as an apology. */
  title: string;
  /** How to put something here, in one line. */
  description?: string;
  /** The way out of the empty state. */
  actionLabel?: string;
  /** A glyph before the action's label — `plus` for "Add task". */
  actionIcon?: IconName;
  onAction?: () => void;
  style?: ViewStyle;
}

/** The Lists sheet's tile and its glyph, in points. */
const TILE = 56;
const GLYPH = 28;

/**
 * What a list shows when it has nothing in it — the Lists sheet's empty
 * state: an icon in a 56pt `muted` tile, a `title`, one `body-sm` line in
 * `muted-foreground`, and an optional primary action.
 *
 * Always something, never a blank screen: an empty area is not
 * distinguishable from a screen that failed to load, and the User's next move
 * differs completely between the two. A view that fills itself — Checked —
 * shows the same block without the action.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  style,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.content,
        // The sheet spaces the block at 12, exactly between the `sm` and `md`
        // steps; a tie rounds up.
        { gap: theme.spacing.md, paddingHorizontal: theme.spacing.gutter },
        style,
      ]}
    >
      {icon != null && (
        <View
          style={[
            styles.tile,
            {
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.muted,
            },
          ]}
        >
          <Icon name={icon} size={GLYPH} />
        </View>
      )}
      <Text variant="title" accessibilityRole="header" style={styles.centred}>
        {title}
      </Text>
      {description != null && (
        <Text variant="bodySm" color="mutedForeground" style={styles.centred}>
          {description}
        </Text>
      )}
      {actionLabel != null && onAction != null && (
        <Button
          label={actionLabel}
          icon={actionIcon}
          variant="primary"
          onPress={onAction}
          style={{ marginTop: theme.spacing.xs }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centred: {
    textAlign: 'center',
  },
});
