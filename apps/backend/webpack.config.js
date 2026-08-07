/**
 * This is the webpack configuration from this thread:
 * https://github.com/nrwl/nx/issues/22945#issuecomment-2363459393
 *
 * Note: in the future if there is an alternative solution from Nx, the configuration will be updated.
 */

const { composePlugins, withNx } = require('@nx/webpack');
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');

module.exports = composePlugins(
  // Default Nx composable plugin
  withNx(),
  // Custom composable plugin
  (config, { options, context }) => {
    // `config` is the Webpack configuration object
    // `options` is the options passed to the `@nx/webpack:webpack` executor
    // `context` is the context passed to the `@nx/webpack:webpack` executor

    // Explicitly register tsconfig path aliases so that workspace library imports
    // (e.g. @myorganizer/auth) are resolved correctly by webpack.
    // This is required after the @nx/webpack 22.7.x upgrade which no longer
    // auto-wires tsconfig paths into the webpack resolver for node targets.
    config.resolve = config.resolve || {};
    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push(
      new TsconfigPathsPlugin({
        configFile: 'tsconfig.base.json',
      })
    );

    return config;
  }
);
