import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { Button, type ButtonVariant } from './Button';
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
  /** The action's view, for a screen that moves focus to it. */
  actionRef?: React.Ref<React.ComponentRef<typeof View>>;
  /**
   * The action's weight. `primary` by default; the Tasks "All clear" state
   * offers "Show done" as `secondary`, because nothing there is to be done.
   */
  actionVariant?: ButtonVariant;
  /**
   * Which side of the label `actionIcon` sits. `leading` by default; the
   * Details empty state's "Open the web app" ends in the external-link glyph,
   * because it leaves the app (Det-List-Empty).
   */
  actionIconPosition?: 'leading' | 'trailing';
  /**
   * `neutral` (the default) draws the glyph on the `muted` tile. `success`
   * tints the tile `success` at 12% and draws the glyph in `success` — a
   * list that is empty because everything in it is finished (Tasks' "All
   * clear"), not because nothing was ever added.
   */
  tone?: 'neutral' | 'success';
  style?: ViewStyle;
}

/** The sheet's tint behind a `success` glyph. No token carries an alpha. */
const SUCCESS_TINT_OPACITY = 0.12;

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
  actionRef,
  actionVariant = 'primary',
  actionIconPosition = 'leading',
  tone = 'neutral',
  style,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();
  const success = tone === 'success';

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
              backgroundColor: success ? undefined : theme.colors.muted,
            },
          ]}
        >
          {success && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: theme.radii.xl,
                  backgroundColor: theme.colors.success,
                  opacity: SUCCESS_TINT_OPACITY,
                },
              ]}
            />
          )}
          <Icon
            name={icon}
            size={GLYPH}
            color={success ? 'success' : 'foreground'}
            strokeWidth={success ? 2.6 : undefined}
          />
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
          ref={actionRef}
          label={actionLabel}
          icon={actionIcon}
          variant={actionVariant}
          iconPosition={actionIconPosition}
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
