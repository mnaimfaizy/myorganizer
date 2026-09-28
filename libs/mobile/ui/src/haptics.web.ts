/**
 * The haptics Platform Variant for the `react-native-web` target.
 *
 * `react-native-haptic-feedback` is a native module with no web half, so
 * importing it in the browser build throws. A browser has no haptic engine to
 * ask, and the web target exists to lay screens out rather than to reproduce
 * the device, so both feedbacks are no-ops here rather than being approximated
 * with something a phone would never do.
 */
export const haptics = {
  tick: (): void => undefined,
  untick: (): void => undefined,
} as const;
