// Jest sets NODE_ENV only when it is not already set, and Nx loads the
// workspace dotenv file into every task environment. This project sets
// `preset: 'react-native'` and so does not inherit the workspace
// `jest.preset.js`, where the same pin and its full reasoning live.
process.env.NODE_ENV = 'test';

export default {
  displayName: 'mobile-ui',
  // The React Native preset, not the workspace one: a spec here renders React
  // Native components, which needs the runtime's own Haste platform
  // resolution, asset transformer, and test environment. The workspace preset
  // is jsdom-based, and a browser global that cannot exist on a device must
  // not be able to pass a test here (ADR 0103).
  preset: 'react-native',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    // The React the device renders with. Metro aliases React to
    // `react-for-native` (19.0.0) because React Native 0.79's bundled renderer
    // asserts an exact version match against it, and that assertion fires here
    // too: `findNodeHandle` loads that renderer, so a spec running against the
    // workspace React fails on the version pair rather than on anything it
    // asserts.
    '^react$': require.resolve('react-for-native'),
    '^react/jsx-runtime$': require.resolve('react-for-native/jsx-runtime'),
    '^react/jsx-dev-runtime$':
      require.resolve('react-for-native/jsx-dev-runtime'),
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
  // The React Native preset transforms its own scope only. These four ship
  // untranspiled ES modules and are imported by the primitives under test.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-haptic-feedback)/)',
  ],
  coverageDirectory: '../../../coverage/libs/mobile/ui',
};
