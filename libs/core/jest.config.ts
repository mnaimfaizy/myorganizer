module.exports = {
  displayName: 'core',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/core',
  // Every spec here covered Vault record code, which moved to vault-core
  // with its specs (#164). Nothing left in core is tested yet.
  passWithNoTests: true,
};
