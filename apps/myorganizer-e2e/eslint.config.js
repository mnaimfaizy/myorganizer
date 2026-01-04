const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
