import { Easing } from 'react-native-reanimated';

/**
 * The approved Motion sheet's timings, in milliseconds, in one place.
 *
 * The tick sequence is the one choreographed motion in the app: press, commit,
 * settle, dwell, leave, enter. Every beat has a Reduce Motion alternative,
 * and that alternative keeps the dwell — 600 ms to untick a mis-tap in place
 * is time to undo, which is not motion.
 */
export const MOTION = {
  /** Touch down: the box scales to 0.92 and the state layer appears. */
  press: 80,
  /** Touch up: the fill fades in and the check draws. */
  commit: 160,
  /** The title mutes and the strikethrough draws. */
  settle: 160,
  /** The row holds still, so a mis-tap can be unticked in place. */
  dwell: 600,
  /** Height and opacity to 0; the rows below slide up. */
  leave: 220,
  /** Enter the Checked section: fade in and drop from −8 pt. */
  enter: 220,
  /** Every travelling beat's Reduce Motion stand-in: opacity only. */
  reducedFade: 150,
  /** ProgressMeter width tween. */
  meter: 220,
} as const;

/** How far a pressed checkbox shrinks. */
export const PRESS_SCALE = 0.92;

/** Where an entering row starts, above its resting place. */
export const ENTER_OFFSET_Y = -8;

/**
 * The sheet's easing curves. `standard` is the Material standard curve the
 * sheet names for leave and revert; `emphasized` is the check-draw curve.
 */
export const EASING = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  emphasized: Easing.bezier(0.2, 0, 0, 1),
  out: Easing.out(Easing.ease),
} as const;
