import { Platform } from 'react-native';
import ReactNativeHapticFeedback, {
  type HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

/**
 * Haptics are silent on a device that has them switched off, and this asks the
 * OS rather than deciding: `ignoreAndroidSystemSettings: false` means a User
 * who turned off touch feedback gets none.
 */
const OPTIONS = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
} as const;

/** The feedbacks this app gives, named for what the User did. */
type Feedback = 'tick' | 'untick' | 'revert';

/**
 * Each feedback as the approved Motion sheet names it, per platform:
 *
 * - **tick** — iOS impact, light; Android `TOGGLE_ON` (API 34+), which the
 *   library falls back to a clock-tick-length pulse below that.
 * - **untick** — iOS selection; Android `TOGGLE_OFF`. A correction, so it is
 *   the lighter of the pair, and different on purpose: one buzz for both
 *   leaves the two indistinguishable in a pocket.
 * - **revert** — iOS notification, warning; Android `REJECT` (API 30+). Fired
 *   when an Unconfirmed Edit is put back to the last server copy.
 *
 * Pinned to the feedback set, so a feedback with no waveform on one platform
 * is a compile error rather than a silent no-op there.
 */
const WAVEFORM = {
  tick: { ios: 'impactLight', android: 'toggleOn' },
  untick: { ios: 'selection', android: 'toggleOff' },
  revert: { ios: 'notificationWarning', android: 'reject' },
} as const satisfies Record<
  Feedback,
  {
    ios: keyof typeof HapticFeedbackTypes;
    android: keyof typeof HapticFeedbackTypes;
  }
>;

function fire(feedback: Feedback): void {
  const waveform = WAVEFORM[feedback];
  ReactNativeHapticFeedback.trigger(
    Platform.OS === 'android' ? waveform.android : waveform.ios,
    OPTIONS,
  );
}

/**
 * The haptics a control gives, fired once at the moment the thing commits —
 * a tick on touch up, never on touch down, while a swipe reveals, or during a
 * scroll. Reduce Motion never removes one: a haptic is not motion.
 */
export const haptics = {
  tick: (): void => fire('tick'),
  untick: (): void => fire('untick'),
  revert: (): void => fire('revert'),
} as const;
