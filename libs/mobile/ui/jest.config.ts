// Jest sets NODE_ENV only when it is not already set, and Nx loads the
// workspace dotenv file into every task environment. This project sets the
// React Native preset and so does not inherit the workspace
// `jest.preset.js`, where the same pin and its full reasoning live.
process.env.NODE_ENV = 'test';

// CommonJS, as `apps/mobile/jest.config.ts` is: the mappers below need
// `require.resolve` and `__dirname`. Where Node strips TypeScript natively
// (22.18+), Jest imports this file directly, and `export default` would make
// it an ES module in which neither exists.
module.exports = {
  displayName: 'mobile-ui',
  // The React Native preset, not the workspace one: a spec here renders React
  // Native components, which needs the runtime's own Haste platform
  // resolution, asset transformer, and test environment. The workspace preset
  // is jsdom-based, and a browser global that cannot exist on a device must
  // not be able to pass a test here (ADR 0103).
  preset: '@react-native/jest-preset',
  resolver: '<rootDir>/jest.resolver.js',
  // The first render in a spec file loads React Native's lazily required
  // renderer and host components. Locally that takes a fraction of a second,
  // but on a CI runner shared with every other project's tests it has run
  // past Jest's 5-second default. The two tests that did were each the
  // first in their file, and the other tests in both files passed.
  testTimeout: 30_000,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@testing-library/react-native$':
      require.resolve('@testing-library/react-native'),
  },
  // The gesture handler's own Jest setup, which registers its native module
  // stubs before React Native's registry is read.
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      { configFile: `${__dirname}/.babelrc.js` },
    ],
  },
  // The React Native preset transforms its own scope only. These five ship
  // untranspiled ES modules and are imported by the primitives under test.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-gesture-handler|react-native-reanimated|react-native-worklets|react-native-safe-area-context|react-native-haptic-feedback)/)',
  ],
  coverageDirectory: '../../../coverage/libs/mobile/ui',
};
