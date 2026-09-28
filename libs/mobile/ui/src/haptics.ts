import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

/**
 * Haptics are silent on a device that has them switched off, and this asks the
 * OS rather than deciding: `ignoreAndroidSystemSettings: false` means a User
 * who turned off touch feedback gets none.
 */
const OPTIONS = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
} as const;

/**
 * The two feedbacks a tickable control gives, named for what the User did
 * rather than for the waveform.
 *
 * Ticking something off is the moment worth confirming, so it is the heavier
 * of the two; unticking is a correction and takes the lighter selection
 * feedback. They are different on purpose — a single buzz for both leaves the
 * two indistinguishable in a pocket.
 */
export const haptics = {
  tick: (): void => {
    ReactNativeHapticFeedback.trigger('impactMedium', OPTIONS);
  },
  untick: (): void => {
    ReactNativeHapticFeedback.trigger('selection', OPTIONS);
  },
} as const;
