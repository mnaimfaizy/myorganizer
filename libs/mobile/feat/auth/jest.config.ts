export default {
  displayName: 'mobile-feat-auth',
  preset: '../../../../jest.preset.js',
  // `node`, not the preset's jsdom. This project's spec covers
  // `sessionRefresh.ts`, which carries no `react-native` or keychain import on
  // purpose — a jsdom or React Native environment is neither needed nor
  // available here (ADR 0103: the mobile native typecheck program has no
  // `dom`).
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../../coverage/libs/mobile/feat/auth',
};
