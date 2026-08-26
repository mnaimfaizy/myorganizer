/// <reference types="jest" />
/// <reference types="node" />

// This project sets `preset: 'react-native'` and so does not inherit the
// workspace `jest.preset.js`, where the same pin lives and carries the full
// reasoning. Nx loads the workspace dotenv file into task environments, so an
// ambient NODE_ENV would otherwise reach jest here too. No-op while this
// project has no tests; here so the first one added is not the one that finds
// out.
process.env.NODE_ENV = 'test';

module.exports = {
  displayName: 'mobile',
  preset: 'react-native',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '\\.svg$': '@nx/react-native/plugins/jest/svg-mock',
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$':
      require.resolve('react-native/jest/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
  passWithNoTests: true,
};
