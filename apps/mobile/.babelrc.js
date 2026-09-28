module.exports = function (api) {
  api.cache(true);

  if (
    process.env.NX_TASK_TARGET_TARGET === 'build' ||
    process.env.NX_TASK_TARGET_TARGET?.includes('storybook')
  ) {
    return {
      presets: [
        [
          '@nx/react/babel',
          {
            runtime: 'automatic',
          },
        ],
      ],
    };
  }

  return {
    presets: [
      ['module:@react-native/babel-preset', { useTransformReactJSX: true }],
    ],
    // Reanimated's plugin rewrites worklets so they can run on the UI thread.
    // It must stay last in the plugin list — it reads the output of every
    // other transform — and a worklet built without it fails when it is
    // called, not when it is compiled.
    plugins: ['react-native-reanimated/plugin'],
  };
};
