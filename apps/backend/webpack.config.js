const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');

/**
 * The backend build is the Inferred Target `@nx/webpack/plugin` derives from
 * this file (`webpack-cli build`, run from `apps/backend`), so every option
 * the retired `@nx/webpack:webpack` executor carried lives here instead
 * (ADR 0083). Paths are relative to this directory.
 */
module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/backend'),
  },
  resolve: {
    // Explicitly register tsconfig path aliases so that workspace library
    // imports (e.g. @myorganizer/auth) resolve. NxAppWebpackPlugin's own
    // tsconfig-paths wiring does not resolve them for this node target: the
    // build fails on `@myorganizer/email-shell` without this plugin.
    plugins: [
      new TsconfigPathsPlugin({
        configFile: join(__dirname, '../../tsconfig.base.json'),
      }),
    ],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      externalDependencies: 'all',
      generatePackageJson: true,
      outputHashing: 'none',
      // The plugin minifies whenever NODE_ENV is production, which the
      // executor never did; keep the deployed bundle readable in stack traces.
      optimization: false,
      sourceMap: false,
    }),
  ],
};
