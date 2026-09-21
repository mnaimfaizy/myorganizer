module.exports = {
  displayName: 'escape-copy-reader',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  setupFilesAfterEnv: [
    '<rootDir>/../../tools/testing/web-crypto-test-setup.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/escape-copy-reader',
};
