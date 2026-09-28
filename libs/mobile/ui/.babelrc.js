/**
 * Babel for this library's Jest project.
 *
 * The React Native preset, because a spec here renders React Native
 * components and the runtime's own source is Flow-typed. The Reanimated
 * plugin is listed last, as that plugin requires, so a worklet compiles
 * rather than failing at call time.
 */
module.exports = {
  presets: [
    ['module:@react-native/babel-preset', { useTransformReactJSX: true }],
  ],
  plugins: ['react-native-reanimated/plugin'],
};
