/**
 * Jest resolver for this library.
 *
 * Reanimated 4 and `react-native-worklets` each ship a `.native` and a plain
 * implementation of the modules that reach their native half, and publish a
 * resolver that picks the plain one under Jest. Without it the React Native
 * preset's platform resolution loads the `.native` files, which throw on
 * import because there is no native module to call.
 *
 * That resolver ends in Jest's default one, and this workspace needs the Nx
 * resolver there instead, for the `tsconfig.base.json` path aliases. So the
 * two are chained: Reanimated's narrows the extensions, Nx's resolves.
 */
const nxResolver = require('@nx/jest/plugins/resolver');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (innerRequest, innerOptions) =>
      nxResolver(innerRequest, {
        ...innerOptions,
        defaultResolver: options.defaultResolver,
      }),
  });
