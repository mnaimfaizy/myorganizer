export default {
  displayName: 'mobile-ui',
  preset: '../../../jest.preset.js',
  // `node`, not the preset's jsdom. A mobile library is typechecked without
  // `dom` on purpose (ADR 0103), and a jsdom test environment would let a
  // browser global that cannot exist on a device pass a test here.
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/libs/mobile/ui',
};
