import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../useTheme';
import { COMFORTABLE_ROW_HEIGHT, MIN_TOUCH_TARGET } from '../metrics';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type { ThemeColors } from '../theme';
import { Icon, type IconName } from './Icon';
import { InlineNotice } from './InlineNotice';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

/** One thing a row can be asked to do, however it is reached. */
export interface RowAction {
  /** Stable within a row. It is the accessibility action's name. */
  id: string;
  /** What the action does, in one or two words. Read out as-is. */
  label: string;
  onPress: () => void;
}

/** One thing a row can be swiped to do. */
export interface SwipeAction extends RowAction {
  icon: IconName;
  tone?: 'neutral' | 'destructive';
}

/**
 * How tall a row is at minimum. `comfortable` is the grocery trip view's: a
 * row ticked one-handed while walking round a shop, drawn well clear of the
 * touch-target floor rather than at it.
 */
export type ListRowSize = 'standard' | 'comfortable';

/**
 * Where a row's edit has got to. `unconfirmed` and `reverted` are the two
 * halves of an Unconfirmed Edit (CONTEXT.md): shown before the server has
 * confirmed its Vault Push, and rolled back to the last confirmed copy with
 * the reason and a retry.
 */
export type ListRowState = 'normal' | 'unconfirmed' | 'reverted';

/** How wide one swipe action's panel is. Big enough to be a touch target. */
const ACTION_WIDTH = 72;

/** How far past a panel's own width a swipe must go before it stays open. */
const OPEN_FRACTION = 0.5;

/** The two row heights, pinned to the size set. */
const ROW_MIN_HEIGHT = {
  standard: MIN_TOUCH_TARGET,
  comfortable: COMFORTABLE_ROW_HEIGHT,
} as const satisfies Record<ListRowSize, number>;

/** The one spring in this library, so every row settles the same way. */
const SPRING = { damping: 20, stiffness: 220 } as const;

const TONE_FILL = {
  neutral: 'secondary',
  destructive: 'destructive',
} as const satisfies Record<'neutral' | 'destructive', keyof ThemeColors>;

const TONE_TEXT = {
  neutral: 'secondaryForeground',
  destructive: 'destructiveForeground',
} as const satisfies Record<'neutral' | 'destructive', keyof ThemeColors>;

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Rendered before the title — a Checkbox, an avatar, a colour dot. */
  leading?: React.ReactNode;
  /** Rendered after the title — a StatusPill, an amount, a chevron. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /**
   * A press held past the platform's long-press threshold — the row's own
   * route to a context menu, for the User who would rather hold the row than
   * learn which way to swipe it. Every action it opens must still be an
   * `innerAction` or a swipe action too, because a hold is a gesture a screen
   * reader cannot perform.
   */
  onLongPress?: () => void;
  /**
   * When given, the row announces as a checkbox in this state rather than as
   * a button, and `onPress` is what toggles it. A row whose whole width is
   * the tick target has to say so: the row is one accessibility element, so a
   * `Checkbox` drawn inside `leading` is not reachable on its own and its
   * role does not reach the screen reader.
   */
  checked?: boolean;
  /** Revealed by a swipe from the left edge. */
  leftActions?: readonly SwipeAction[];
  /** Revealed by a swipe from the right edge. */
  rightActions?: readonly SwipeAction[];
  /**
   * Actions on controls drawn inside the row — a trailing amount button, say.
   * Nothing is drawn for these and no gesture reveals them; they are here
   * because the row is one accessibility element, so a `Pressable` in
   * `leading` or `trailing` is invisible to a screen reader unless the row
   * offers it as an action of its own.
   */
  innerActions?: readonly RowAction[];
  size?: ListRowSize;
  /**
   * Read out instead of the title and subtitle. For a row whose meaning is
   * partly in a control it draws — the trip view's amount — rather than in
   * its two strings.
   */
  accessibilityLabel?: string;
  state?: ListRowState;
  /** The badge on an unconfirmed row. */
  unconfirmedLabel?: string;
  /** Why the edit was reverted. Shown only in the `reverted` state. */
  revertedReason?: string;
  /** Offered beside the reason. Omitting it hides the retry. */
  onRetry?: () => void;
  /**
   * What that offer is called. `Reload` for a conflict, where the way
   * forward is to see the other device's copy rather than to send this edit
   * again — calling that button `Retry` promises the opposite of what it does.
   */
  retryLabel?: string;
  /**
   * `StyleProp` rather than a bare `ViewStyle`, so a caller can merge a
   * `StyleSheet.create` entry with the per-render theme value the row needs —
   * `[styles.row, { borderRadius: theme.radii.md }]` — which is the styling
   * pattern the mobile Agent Guide asks for and a bare `ViewStyle` refuses.
   */
  style?: StyleProp<ViewStyle>;
}

function ActionPanel({
  actions,
  side,
}: {
  actions: readonly SwipeAction[];
  side: 'left' | 'right';
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.panel, side === 'left' ? styles.left : styles.right]}>
      {actions.map((action) => {
        const tone = action.tone ?? 'neutral';
        return (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={[
              styles.action,
              {
                width: ACTION_WIDTH,
                gap: theme.spacing.xs,
                backgroundColor: theme.colors[TONE_FILL[tone]],
              },
            ]}
          >
            <Icon name={action.icon} size={20} color={TONE_TEXT[tone]} />
            <Text variant="caption" color={TONE_TEXT[tone]} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A row in a list, with everything a row in this app has to be able to do.
 *
 * **Swiping is never the only way to reach an action.** Every action is also
 * an accessibility action on the row, which is what puts it in reach of a
 * screen reader, a switch control, and an external keyboard — none of which
 * can perform a drag. The two lists are built from one source here, so an
 * action cannot be added to the gesture and forgotten in the other.
 *
 * **Reduce Motion takes the travel, not the behaviour.** The row still opens
 * and closes and the actions are still there; it arrives without the spring.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  checked,
  leftActions = [],
  rightActions = [],
  innerActions = [],
  size = 'standard',
  accessibilityLabel,
  state = 'normal',
  unconfirmedLabel = 'Unconfirmed',
  revertedReason,
  onRetry,
  retryLabel = 'Retry',
  style,
}: ListRowProps): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const leftWidth = leftActions.length * ACTION_WIDTH;
  const rightWidth = rightActions.length * ACTION_WIDTH;

  const offsetX = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // The list scrolls vertically, so the row only claims the gesture once
        // it is clearly horizontal. Without this a flick down the list opens
        // whichever row it started on.
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .enabled(leftWidth > 0 || rightWidth > 0)
        .onBegin(() => {
          startX.value = offsetX.value;
        })
        .onUpdate((event) => {
          const next = startX.value + event.translationX;
          offsetX.value = Math.min(Math.max(next, -rightWidth), leftWidth);
        })
        .onEnd(() => {
          const open =
            offsetX.value > leftWidth * OPEN_FRACTION
              ? leftWidth
              : offsetX.value < -rightWidth * OPEN_FRACTION
                ? -rightWidth
                : 0;
          offsetX.value = reduceMotion ? open : withSpring(open, SPRING);
        }),
    [leftWidth, rightWidth, offsetX, startX, reduceMotion],
  );

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  // The swipe actions and the accessibility actions are built from one list,
  // so an action cannot be added to the drag and forgotten in the other. The
  // inner ones join it here only: nothing draws them and no gesture reveals
  // them, but the row still offers them.
  const actions = useMemo(
    () => [...leftActions, ...rightActions, ...innerActions],
    [leftActions, rightActions, innerActions],
  );

  const onAccessibilityAction = (event: AccessibilityActionEvent): void => {
    actions
      .find((action) => action.id === event.nativeEvent.actionName)
      ?.onPress();
  };

  return (
    <View style={style}>
      <View style={styles.track}>
        {leftActions.length > 0 && (
          <ActionPanel actions={leftActions} side="left" />
        )}
        {rightActions.length > 0 && (
          <ActionPanel actions={rightActions} side="right" />
        )}
        <GestureDetector gesture={pan}>
          <Animated.View style={sheet}>
            <Pressable
              accessibilityRole={
                checked != null
                  ? 'checkbox'
                  : onPress == null
                    ? undefined
                    : 'button'
              }
              accessibilityState={checked == null ? undefined : { checked }}
              accessibilityLabel={
                accessibilityLabel ??
                (subtitle == null ? title : `${title}, ${subtitle}`)
              }
              accessibilityActions={actions.map((action) => ({
                name: action.id,
                label: action.label,
              }))}
              onAccessibilityAction={onAccessibilityAction}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: theme.spacing.md,
                  minHeight: ROW_MIN_HEIGHT[size],
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor: theme.colors.card,
                },
                state === 'unconfirmed' && styles.unconfirmed,
                pressed && styles.pressed,
              ]}
            >
              {leading}
              <View style={styles.labels}>
                <Text variant="body" numberOfLines={2}>
                  {title}
                </Text>
                {subtitle != null && (
                  <Text variant="caption" numberOfLines={2}>
                    {subtitle}
                  </Text>
                )}
              </View>
              {state === 'unconfirmed' && (
                <StatusPill label={unconfirmedLabel} />
              )}
              {trailing}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
      {state === 'reverted' && revertedReason != null && (
        <InlineNotice
          tone="destructive"
          message={revertedReason}
          actionLabel={onRetry == null ? undefined : retryLabel}
          onAction={onRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    overflow: 'hidden',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  left: {
    left: 0,
  },
  right: {
    right: 0,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labels: {
    flexShrink: 1,
    flexGrow: 1,
  },
  unconfirmed: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
});
