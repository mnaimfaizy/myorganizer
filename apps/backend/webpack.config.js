/**
 * This is the webpack configuration from this thread:
 * https://github.com/nrwl/nx/issues/22945#issuecomment-2363459393
 *
 * Note: in the future if there is an alternative solution from Nx, the configuration will be updated.
 */

const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(
  // Default Nx composable plugin
  withNx(),
  // Custom composable plugin
  (config, { options, context }) => {
    // `config` is the Webpack configuration object
    // `options` is the options passed to the `@nx/webpack:webpack` executor
    // `context` is the context passed to the `@nx/webpack:webpack` executor
    // customize configuration here
    return config;
  }
);
