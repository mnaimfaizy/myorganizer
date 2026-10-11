import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type BlurEvent,
  type FocusEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { staticElement } from '../staticElement';
import { useTheme } from '../useTheme';
import { COMFORTABLE_ROW_HEIGHT, MIN_TOUCH_TARGET } from '../metrics';
import { haptics } from '../haptics';
import { EASING, ENTER_OFFSET_Y, MOTION } from '../motion';
import { noteBlur, noteFocus, type FocusSlot } from '../hooks/focusReturn';
import { useFocusRing } from '../hooks/useFocusRing';
import { useFocusWithin } from '../hooks/useFocusWithin';
import { usePressFeedback } from '../hooks/usePressFeedback';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type { ThemeColors } from '../theme';
import { CHECKBOX_BOX, Checkbox, type CheckboxProps } from './Checkbox';
import { Icon, type IconName } from './Icon';
import { useListRowPosition } from './ListSection';
import { Text, type TextWeight } from './Text';

/** One thing a row can be asked to do, however it is reached. */
export interface RowAction {
  /** Stable within a row. It is the accessibility action's name. */
  id: string;
  /** What the action does, in one or two words. Read out as-is. */
  label: string;
  onPress: () => void;
}

/**
 * How a swipe action is filled. `primary` is the dark fill the Lists sheet
 * draws for a completing action (Done); `neutral` a reversible one (Archive);
 * `destructive` one that removes something.
 */
export type SwipeActionTone = 'primary' | 'neutral' | 'destructive';

/** One thing a row can be swiped to do. */
export interface SwipeAction extends RowAction {
  icon: IconName;
  tone?: SwipeActionTone;
}

/**
 * How tall a row is at minimum. `comfortable` is the grocery trip view's: a
 * row ticked one-handed while walking round a shop, drawn well clear of the
 * touch-target floor rather than at it. `tall` is the Tasks list's: a title
 * line over a meta line that can carry a StatusPill, drawn at 72.
 */
export type ListRowSize = 'standard' | 'comfortable' | 'tall';

/**
 * Where a row's edit has got to. `unconfirmed` and `reverted` are the two
 * halves of an Unconfirmed Edit (CONTEXT.md): shown before the server has
 * confirmed its Vault Push, and rolled back to the last confirmed copy with
 * the reason and a retry.
 */
export type ListRowState = 'normal' | 'unconfirmed' | 'reverted';

/** How wide one swipe action's panel is (Lists sheet). */
const ACTION_WIDTH = 88;

/** How far past a panel's own width a swipe must go before it stays open. */
const OPEN_FRACTION = 0.5;

/**
 * The Lists sheet's row heights: 56 for one line, 64 with a subtitle, and the
 * trip view's comfortable row at 64 whatever it carries. The Tasks sheet
 * draws its rows at 72; no metric carries that height.
 */
const ROW_MIN_HEIGHT = {
  standard: { single: 56, double: 64 },
  comfortable: {
    single: COMFORTABLE_ROW_HEIGHT,
    double: COMFORTABLE_ROW_HEIGHT,
  },
  tall: { single: 72, double: 72 },
} as const satisfies Record<ListRowSize, { single: number; double: number }>;

/** The leading icon tile, 32 or 36 as the sheets draw it, with its glyph. */
const ICON_TILE = {
  standard: { tile: 32, glyph: 18 },
  large: { tile: 36, glyph: 20 },
} as const satisfies Record<
  'standard' | 'large',
  { tile: number; glyph: number }
>;

/**
 * How short a leaving row gets before it is removed: one pixel, not none.
 * Android takes keyboard focus from a view whose size reaches zero, and from
 * whatever inside it held it, and gives it to the first focusable view in the
 * window. A row that closed to nothing with its checkbox focused had lost the
 * focus before it was removed, so there was none left to hand to the next row
 * (#1068, `useFocusSuccession`). The row is fully transparent by then.
 */
const LEAVE_FLOOR = StyleSheet.hairlineWidth;

/** The one spring in this library, so every row settles the same way. */
const SPRING = { damping: 20, stiffness: 220 } as const;

const TONE = {
  primary: { fill: 'primary', text: 'primaryForeground', stroke: 2.5 },
  neutral: { fill: 'secondary', text: 'secondaryForeground', stroke: 2 },
  destructive: {
    fill: 'destructive',
    text: 'destructiveForeground',
    stroke: 2,
  },
} as const satisfies Record<
  SwipeActionTone,
  { fill: keyof ThemeColors; text: keyof ThemeColors; stroke: number }
>;

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /**
   * Sets the title at another weight — the Subscriptions list draws its
   * names at 600 where the Lists sheet's plain row is 400.
   */
  titleWeight?: TextWeight;
  /**
   * Draws the title in `muted-foreground` without striking it — a record
   * that no longer counts (a Cancelled Subscription), not a ticked one.
   */
  muted?: boolean;
  /**
   * Drawn inline after the subtitle, on its line — a StatusPill that
   * qualifies it ("renews in 4 days  MANUAL").
   */
  subtitleAccessory?: React.ReactNode;
  /**
   * Drawn in place of the `subtitle` string, which stays the row's spoken
   * text — a line with a styled run in it, such as the Tasks list's amber
   * "2 days overdue". Only drawn while `subtitle` is given.
   */
  subtitleContent?: React.ReactNode;
  /**
   * Drawn inline before the title, inside the labels column — the Tasks
   * list's priority marker. The divider and a reverted note still start at
   * the labels column, so they line up under it, as the Tasks sheet draws.
   * Decorative: put what it says in `accessibilityLabel`.
   */
  titleAccessory?: React.ReactNode;
  /**
   * Rendered before the title — a Checkbox, an avatar, a colour dot. A bare
   * `Checkbox` is pulled out to the row's edge so its box, not its 44pt
   * target, sits on the 16pt inset, as the Lists sheet draws it.
   */
  leading?: React.ReactNode;
  /** A glyph in the sheet's muted leading tile — used instead of `leading`. */
  leadingIcon?: IconName;
  /** The tile's size: 32 (`standard`) or 36 (`large`). */
  leadingIconSize?: 'standard' | 'large';
  /**
   * The tile glyph's Semantic Role. The body colour by default; Account draws
   * its Lock row's glyph in `brand`.
   */
  leadingIconColor?: keyof ThemeColors;
  /** Rendered after the title — a StatusPill, an amount, a chevron. */
  trailing?: React.ReactNode;
  /** A trailing value in muted tabular figures — an amount, a count. */
  value?: string;
  /** Ends the row in a chevron: it navigates somewhere. */
  chevron?: boolean;
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
   *
   * A checked row draws its title in `muted-foreground` with a strikethrough.
   */
  checked?: boolean;
  /**
   * `false` keeps a checked title muted but unstruck — a notified Usage
   * Location is done yet still listed (Det-UL), where a struck line reads as
   * removed. `true` by default.
   */
  strikeChecked?: boolean;
  /**
   * Where a `checked` row is ticked. `row` (the default) makes the whole row
   * the tick target, as above. `leading` leaves the tick to the Checkbox
   * drawn in `leading`: the row announces as a button, `onPress` opens it,
   * and `checked` only draws the tick sequence — the Tasks list, whose row
   * body opens the Task. The tick must then also be a row action, because
   * the Checkbox inside the row is not reachable by a screen reader.
   */
  tickTarget?: 'row' | 'leading';
  /**
   * When given, the row announces as a switch in this state — a setting row
   * whose trailing `Switch` is drawn for sight (Account's Biometric Unlock).
   * The row is one accessibility element, so the switch inside it is not
   * reachable on its own; `onPress` is what flips it, and the screen hides
   * the drawn switch from the accessibility tree. `disabled` announces a
   * switch that cannot be flipped without dimming the row the way the
   * row-level `disabled` does, for a screen that dims it as drawn.
   */
  toggle?: { value: boolean; disabled?: boolean };
  /**
   * Opts the row into the rest of the Motion sheet's tick sequence. When
   * `checked` turns true, the title mutes and strikes (160 ms), the row
   * holds still for the 600 ms dwell — an untick in that window cancels and
   * the row stays — and then leaves: height and opacity to 0 over 220 ms
   * (opacity only, 150 ms, under Reduce Motion). This is called when it has
   * left; the screen moves the line to Checked here, and until then keeps
   * rendering it where it was.
   */
  onTickSettled?: () => void;
  /**
   * Plays the "enter Checked" beat when the row mounts: fade in and drop from
   * −8 pt over 220 ms ease-out (opacity only, 150 ms, under Reduce Motion).
   * Also the way back for a reverted move — the same motion in reverse.
   */
  entering?: boolean;
  /** Dims the row to 40% and takes it off the focus path. */
  disabled?: boolean;
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
  /** The inline note on an unconfirmed row. */
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
  /**
   * The view that takes the row's focus and its ring, for a list that hands
   * focus on when a row leaves (`useFocusSuccession`).
   */
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

/**
 * One swipe action. Its own component so that each tile owns its ring.
 *
 * Read out only while its panel is revealed. Behind a closed row it is drawn
 * but covered, so `ActionPanel` hides it from a screen reader and the row
 * offers it as an accessibility action instead. It stays `accessible` itself,
 * which on Android is the prop that makes a view focusable.
 *
 * Always a keyboard stop, because a hardware keyboard cannot swipe and has no
 * other route to it (#1027). A stop nobody can see is what #1022 removed —
 * its ring drew behind the row — so taking focus tells the row, which slides
 * open to show it, and losing focus lets the row shut again.
 *
 * Its ring is drawn in the tile's own text colour, not the `focus` role: the
 * ring sits inside the fill, and `focus` on the `primary` fill of Done is
 * dark on dark.
 */
function PanelAction({
  action,
  onKeyboardFocus,
  onKeyboardBlur,
}: {
  action: SwipeAction;
  onKeyboardFocus: () => void;
  onKeyboardBlur: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const focus = useFocusRing('inset');
  const tone = TONE[action.tone ?? 'neutral'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      focusable
      onPress={action.onPress}
      android_ripple={focus.ripple()}
      onFocus={(event: FocusEvent) => {
        focus.onFocus(event);
        onKeyboardFocus();
      }}
      onBlur={(event: BlurEvent) => {
        focus.onBlur(event);
        onKeyboardBlur();
      }}
      style={[
        styles.action,
        {
          width: ACTION_WIDTH,
          gap: theme.spacing.xs,
          backgroundColor: theme.colors[tone.fill],
        },
        focus.ringStyle,
        focus.ringStyle != null && { outlineColor: theme.colors[tone.text] },
      ]}
    >
      <Icon
        name={action.icon}
        size={20}
        color={tone.text}
        strokeWidth={tone.stroke}
      />
      {/* The sheet sets this at 12/16/600 — `label-caps` without its
          capitals. It takes `caption` at 600, the nearest step that
          keeps the case. */}
      <Text
        variant="caption"
        weight="semibold"
        color={tone.text}
        numberOfLines={1}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

function ActionPanel({
  actions,
  side,
  revealed,
  onKeyboardFocus,
  onKeyboardBlur,
}: {
  actions: readonly SwipeAction[];
  side: 'left' | 'right';
  /** Whether the panel is out from behind the row. */
  revealed: boolean;
  /** Keyboard focus has reached one of this side's actions. */
  onKeyboardFocus: (side: 'left' | 'right') => void;
  onKeyboardBlur: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      // Covered by a closed row, so hidden from a screen reader as well: the
      // row itself offers every one of these as an accessibility action.
      accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
      // Kept as a native view in both states. Left to React Native it is
      // flattened away once `revealed` drops the prop above, and its actions
      // are moved to another parent: the one holding keyboard focus lost it
      // in the move, the moment it opened the row (#1027).
      collapsable={false}
      style={[styles.panel, side === 'left' ? styles.left : styles.right]}
    >
      {actions.map((action) => (
        <PanelAction
          key={action.id}
          action={action}
          onKeyboardFocus={() => onKeyboardFocus(side)}
          onKeyboardBlur={onKeyboardBlur}
        />
      ))}
    </View>
  );
}

/**
 * The Unconfirmed row's inline "Saving…": a turning arc and the words.
 * Exported for a value the same edit is showing outside a row — a detail
 * screen's hero amount (Subscriptions · Detail · Saving).
 */
export function SavingNote({
  label = 'Saving…',
}: {
  label?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
    );
  }, [reduceMotion, turn]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));

  return (
    <View style={[styles.inline, { gap: theme.spacing.xs }]}>
      <Animated.View style={spin}>
        <Icon name="saving" size={14} color="warning" strokeWidth={2.5} />
      </Animated.View>
      {/* 13/18/600 on the sheet: `caption` at 600. */}
      <Text
        variant="caption"
        weight="semibold"
        color="warning"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The reverted row's note: why the edit was put back, and the way forward.
 * Indented to the title, on the row's own surface, per the Lists sheet.
 */
function RevertedNote({
  reason,
  actionLabel,
  onAction,
  inset,
}: {
  reason: string;
  actionLabel: string;
  onAction?: () => void;
  inset: number;
}): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing();

  return (
    <View
      style={[
        styles.inline,
        {
          gap: theme.spacing.sm,
          paddingLeft: inset,
          paddingRight: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          backgroundColor: theme.colors.card,
        },
      ]}
    >
      <Icon name="warning" size={16} color="warning" />
      <Text
        variant="caption"
        color="foreground"
        accessibilityRole="alert"
        style={styles.grow}
      >
        {reason}
      </Text>
      {onAction != null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          android_ripple={focus.ripple(press.android_ripple)}
          style={({ pressed }) => [
            styles.inline,
            styles.retry,
            {
              minHeight: MIN_TOUCH_TARGET,
              // The sheet's 12 and 6 each fall exactly between two spacing
              // steps; a tie rounds up.
              paddingHorizontal: theme.spacing.md,
              gap: theme.spacing.sm,
              borderRadius: theme.radii.md,
              borderColor: theme.colors.controlEdge,
            },
            press.pressedStyle(pressed),
            focus.ringStyle,
          ]}
        >
          <Icon name="retry" size={16} />
          <Text variant="bodySm" weight="semibold">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** How far a bare Checkbox is pulled out, so its box sits on the inset. */
function checkboxBleed(leading: React.ReactNode): number {
  if (!React.isValidElement<CheckboxProps>(leading)) return 0;
  if (leading.type !== Checkbox || leading.props.label != null) return 0;
  const { box } = CHECKBOX_BOX[leading.props.size ?? 'standard'];
  return (MIN_TOUCH_TARGET - box) / 2;
}

/**
 * A row in a list, with everything a row in this app has to be able to do.
 *
 * **Swiping is never the only way to reach an action.** Every action is also
 * an accessibility action on the row, which is what puts it in reach of a
 * screen reader and a switch control, neither of which can perform a drag.
 * The two lists are built from one source here, so an action cannot be added
 * to the gesture and forgotten in the other. A hardware keyboard reaches a
 * swipe action by Tab: the action is a stop beside its row, and the row opens
 * for as long as focus is on it (#1027).
 *
 * **Reduce Motion takes the travel, not the behaviour.** The row still opens
 * and closes and the actions are still there; it arrives without the spring.
 * The tick sequence keeps its dwell and swaps every travelling beat for a
 * cross-fade.
 *
 * Inside a `ListSection` every row but the last draws a hairline divider,
 * inset to where its title starts.
 */
export function ListRow({
  title,
  subtitle,
  titleWeight,
  muted = false,
  subtitleAccessory,
  subtitleContent,
  titleAccessory,
  leading,
  leadingIcon,
  leadingIconSize = 'standard',
  leadingIconColor = 'foreground',
  toggle,
  trailing,
  value,
  chevron = false,
  onPress,
  onLongPress,
  checked,
  strikeChecked = true,
  tickTarget = 'row',
  onTickSettled,
  entering = false,
  disabled = false,
  leftActions = [],
  rightActions = [],
  innerActions = [],
  size = 'standard',
  accessibilityLabel,
  state = 'normal',
  unconfirmedLabel = 'Saving…',
  revertedReason,
  onRetry,
  retryLabel = 'Retry',
  style,
  ref,
}: ListRowProps): React.JSX.Element {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const press = usePressFeedback();
  const focus = useFocusRing('inset');
  const position = useListRowPosition();

  // Where the title starts, measured, so the divider and a reverted note line
  // up with it whatever the leading slot holds.
  const [titleInset, setTitleInset] = useState<number>(theme.spacing.md);
  const onLabelsLayout = (event: LayoutChangeEvent): void => {
    const { x } = event.nativeEvent.layout;
    setTitleInset((current) => (current === x ? current : x));
  };

  const leftWidth = disabled ? 0 : leftActions.length * ACTION_WIDTH;
  const rightWidth = disabled ? 0 : rightActions.length * ACTION_WIDTH;

  const offsetX = useSharedValue(0);
  const startX = useSharedValue(0);
  // Whether the action panels are out from behind the sheet. Set as a drag
  // starts, or as keyboard focus reaches an action, and cleared once the row
  // has settled shut, so the panels are read out for exactly as long as they
  // can be seen.
  const [revealed, setRevealed] = useState(false);

  // The keyboard's swipe: the row opens to the side whose action took focus,
  // and shuts once focus is on none of its actions.
  const settleTo = (open: number): void => {
    const shut = open === 0;
    if (reduceMotion) {
      offsetX.value = open;
      if (shut) setRevealed(false);
      return;
    }
    offsetX.value = withSpring(open, SPRING, (finished) => {
      if (finished && shut) runOnJS(setRevealed)(false);
    });
  };
  const actionFocus = useFocusWithin(() => settleTo(0));

  // Focus on one of the row's actions is noted as the row's own, because the
  // row is what a list knows: an action that removes its row — Done on a
  // Task — then hands focus to the next row like the tick does, instead of
  // leaving it to Android (`useFocusSuccession`).
  const rowView = useRef<React.ComponentRef<typeof View> | null>(null);
  const actionSlot = useRef<FocusSlot['current']>(null);
  const setRowView = useCallback(
    (view: React.ComponentRef<typeof View> | null) => {
      rowView.current = view;
      if (typeof ref === 'function') return ref(view);
      if (ref != null) ref.current = view;
      return undefined;
    },
    [ref],
  );
  useEffect(() => () => noteBlur(actionSlot), []);

  const onActionFocus = (side: 'left' | 'right'): void => {
    actionFocus.onFocus();
    actionSlot.current = rowView.current;
    if (actionSlot.current !== null) noteFocus(actionSlot);
    setRevealed(true);
    settleTo(side === 'left' ? leftWidth : -rightWidth);
  };
  const onActionBlur = (): void => {
    noteBlur(actionSlot);
    actionFocus.onBlur();
  };

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
        .onStart(() => {
          runOnJS(setRevealed)(true);
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
          const shut = open === 0;
          if (reduceMotion) {
            offsetX.value = open;
            if (shut) runOnJS(setRevealed)(false);
            return;
          }
          offsetX.value = withSpring(open, SPRING, (finished) => {
            // A drag that catches the row mid-spring leaves it revealed.
            if (finished && shut) runOnJS(setRevealed)(false);
          });
        }),
    [leftWidth, rightWidth, offsetX, startX, reduceMotion],
  );

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }],
  }));

  // --- The tick sequence: strike and mute, dwell, leave; enter. -----------

  const struck = useSharedValue(checked === true ? 1 : 0);
  const leave = useSharedValue(0);
  const leaving = useSharedValue(false);
  const measuredHeight = useSharedValue(0);
  const enter = useSharedValue(entering ? 0 : 1);
  const previousChecked = useRef(checked);
  const [dwelling, setDwelling] = useState(false);
  // Android fades a view group child by child, so a row fading in shows its
  // swipe action panels through the sheet; iOS fades the group as one layer.
  const [fadingIn, setFadingIn] = useState(entering === true);
  const settled = useRef(onTickSettled);
  settled.current = onTickSettled;

  useEffect(() => {
    const was = previousChecked.current;
    previousChecked.current = checked;
    if (was === checked) return;
    const to = checked === true ? 1 : 0;
    struck.value = reduceMotion
      ? to
      : withTiming(to, { duration: MOTION.settle });
    // Any change puts a leaving row back: a revert runs the move in reverse.
    leaving.value = false;
    leave.value = 0;
    setDwelling(was === false && checked === true);
  }, [checked, reduceMotion, struck, leave, leaving]);

  useEffect(() => {
    if (!dwelling || settled.current == null) return;
    const finish = (): void => {
      setDwelling(false);
      settled.current?.();
    };
    const timer = setTimeout(() => {
      leaving.value = !reduceMotion;
      leave.value = withTiming(
        1,
        reduceMotion
          ? { duration: MOTION.reducedFade }
          : { duration: MOTION.leave, easing: EASING.standard },
        (finished) => {
          if (finished) runOnJS(finish)();
        },
      );
    }, MOTION.settle + MOTION.dwell);
    return () => clearTimeout(timer);
  }, [dwelling, reduceMotion, leave, leaving]);

  useEffect(() => {
    if (!entering) return;
    enter.value = withTiming(
      1,
      reduceMotion
        ? { duration: MOTION.reducedFade }
        : { duration: MOTION.enter, easing: EASING.out },
      (finished) => {
        if (finished) runOnJS(setFadingIn)(false);
      },
    );
    // Mount-only on purpose: `entering` describes how the row arrived, not a
    // state it can move into later.
  }, []);

  const lifecycle = useAnimatedStyle(() => {
    const rise = reduceMotion ? 0 : ENTER_OFFSET_Y * (1 - enter.value);
    return {
      opacity: enter.value * (1 - leave.value),
      transform: [{ translateY: rise }],
      ...(leaving.value
        ? {
            height: Math.max(
              measuredHeight.value * (1 - leave.value),
              LEAVE_FLOOR,
            ),
            overflow: 'hidden',
          }
        : {}),
    };
  });

  const titleUnstruck = useAnimatedStyle(() => ({ opacity: 1 - struck.value }));
  const titleStruck = useAnimatedStyle(() => ({ opacity: struck.value }));

  const onRowLayout = (event: LayoutChangeEvent): void => {
    if (!leaving.value) measuredHeight.value = event.nativeEvent.layout.height;
  };

  // Fired on the transition, never on mount: a row scrolled into view already
  // reverted is not a new revert.
  const previousState = useRef(state);
  useEffect(() => {
    if (previousState.current !== state && state === 'reverted') {
      haptics.revert();
    }
    previousState.current = state;
  }, [state]);

  // The swipe actions and the accessibility actions are built from one list,
  // so an action cannot be added to the drag and forgotten in the other. The
  // inner ones join it here only: nothing draws them and no gesture reveals
  // them, but the row still offers them.
  const actions = useMemo(
    () => (disabled ? [] : [...leftActions, ...rightActions, ...innerActions]),
    [disabled, leftActions, rightActions, innerActions],
  );

  const onAccessibilityAction = (event: AccessibilityActionEvent): void => {
    actions
      .find((action) => action.id === event.nativeEvent.actionName)
      ?.onPress();
  };

  // A toggle that cannot be flipped refuses presses and announces as
  // disabled, but is not dimmed here: the screen dims it as drawn.
  const pressDisabled = disabled || toggle?.disabled === true;
  // A row that does nothing when activated — Account's Version — is read as
  // one element and is no keyboard stop.
  const interactive =
    !pressDisabled && (onPress != null || checked != null || toggle != null);
  const bleed = checkboxBleed(leading);
  const tile = ICON_TILE[leadingIconSize];
  const height = ROW_MIN_HEIGHT[size][subtitle == null ? 'single' : 'double'];
  const showDivider = position != null && !position.last;
  const showReverted = state === 'reverted' && revertedReason != null;

  return (
    <Animated.View
      onLayout={onRowLayout}
      needsOffscreenAlphaCompositing={fadingIn || dwelling}
      style={[style, disabled && styles.disabled, lifecycle]}
    >
      <View style={[styles.track, { backgroundColor: theme.colors.card }]}>
        {leftActions.length > 0 && !disabled && (
          <ActionPanel
            actions={leftActions}
            side="left"
            revealed={revealed}
            onKeyboardFocus={onActionFocus}
            onKeyboardBlur={onActionBlur}
          />
        )}
        {rightActions.length > 0 && !disabled && (
          <ActionPanel
            actions={rightActions}
            side="right"
            revealed={revealed}
            onKeyboardFocus={onActionFocus}
            onKeyboardBlur={onActionBlur}
          />
        )}
        <GestureDetector gesture={pan}>
          <Animated.View style={sheet}>
            <Pressable
              ref={setRowView}
              accessibilityRole={
                toggle != null
                  ? 'switch'
                  : checked != null && tickTarget === 'row'
                    ? 'checkbox'
                    : onPress == null
                      ? undefined
                      : 'button'
              }
              accessibilityState={{
                checked: toggle?.value ?? checked ?? undefined,
                disabled: pressDisabled,
                // Always a boolean, never left out. Android writes "busy"
                // into the row's content description, and React Native
                // rebuilds that only when the state it is handed still has
                // a `busy` key (`BaseViewManager.setViewState`): a key that
                // went from `true` to absent left every saved row reading
                // "…, busy" until it unmounted (#1077).
                busy: state === 'unconfirmed',
              }}
              accessibilityLabel={
                accessibilityLabel ??
                (subtitle == null ? title : `${title}, ${subtitle}`)
              }
              accessibilityActions={actions.map((action) => ({
                name: action.id,
                label: action.label,
              }))}
              onAccessibilityAction={onAccessibilityAction}
              disabled={pressDisabled}
              {...(interactive ? null : staticElement())}
              focusable={interactive}
              onPress={onPress}
              onLongPress={onLongPress}
              onFocus={focus.onFocus}
              onBlur={focus.onBlur}
              android_ripple={focus.ripple(
                onPress == null ? undefined : press.android_ripple,
              )}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: theme.spacing.md,
                  minHeight: height,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  backgroundColor: theme.colors.card,
                },
                onPress != null && press.pressedStyle(pressed),
                focus.ringStyle,
              ]}
            >
              {leadingIcon != null ? (
                <View
                  style={[
                    styles.tile,
                    {
                      width: tile.tile,
                      height: tile.tile,
                      borderRadius: theme.radii.md,
                      backgroundColor: theme.colors.muted,
                    },
                  ]}
                >
                  <Icon
                    name={leadingIcon}
                    size={tile.glyph}
                    color={leadingIconColor}
                  />
                </View>
              ) : bleed > 0 ? (
                <View style={{ marginHorizontal: -bleed }}>{leading}</View>
              ) : (
                leading
              )}
              <View style={styles.labels} onLayout={onLabelsLayout}>
                <View
                  style={
                    titleAccessory != null
                      ? [styles.inline, { gap: theme.spacing.sm }]
                      : undefined
                  }
                >
                  {titleAccessory}
                  <View
                    style={titleAccessory != null ? styles.grow : undefined}
                  >
                    <Animated.View style={titleUnstruck}>
                      <Text
                        variant="body"
                        weight={titleWeight}
                        color={muted ? 'mutedForeground' : undefined}
                        numberOfLines={2}
                      >
                        {title}
                      </Text>
                    </Animated.View>
                    {checked != null && (
                      <Animated.View
                        style={[StyleSheet.absoluteFill, titleStruck]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Text
                          variant="body"
                          weight={titleWeight}
                          color="mutedForeground"
                          numberOfLines={2}
                          style={strikeChecked ? styles.struck : undefined}
                        >
                          {title}
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                </View>
                {subtitle != null &&
                  (subtitleAccessory == null ? (
                    (subtitleContent ?? (
                      <Text variant="caption" numberOfLines={2}>
                        {subtitle}
                      </Text>
                    ))
                  ) : (
                    <View
                      style={[
                        styles.inline,
                        styles.wrap,
                        { gap: theme.spacing.sm },
                      ]}
                    >
                      {subtitleContent ?? (
                        <Text variant="caption" numberOfLines={1}>
                          {subtitle}
                        </Text>
                      )}
                      {subtitleAccessory}
                    </View>
                  ))}
              </View>
              {state === 'unconfirmed' && (
                <SavingNote label={unconfirmedLabel} />
              )}
              {value != null && (
                // 15/20 muted in tabular figures, as the sheet's trailing value.
                <Text
                  variant="bodySm"
                  color="mutedForeground"
                  numberOfLines={1}
                  style={styles.figures}
                >
                  {value}
                </Text>
              )}
              {trailing}
              {chevron && (
                <Icon name="chevronRight" size={18} color="mutedForeground" />
              )}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
      {showReverted && (
        <RevertedNote
          reason={revertedReason}
          actionLabel={retryLabel}
          onAction={onRetry}
          inset={titleInset}
        />
      )}
      {showDivider && (
        <View
          testID="list-row-divider"
          style={[
            styles.divider,
            { left: titleInset, backgroundColor: theme.colors.border },
          ]}
        />
      )}
    </Animated.View>
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
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flexShrink: 1,
    flexGrow: 1,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrap: {
    flexWrap: 'wrap',
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
  },
  retry: {
    borderWidth: 1,
  },
  divider: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  disabled: {
    opacity: 0.4,
  },
});
