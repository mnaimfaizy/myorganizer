const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const customConfig = {
  cacheVersion: 'mobile',
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
  },
};

module.exports = withNxMetro(mergeConfig(defaultConfig, customConfig), {
  // Change this to true to see debugging info.
  // Useful if you have issues resolving modules
  debug: false,
  // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
  extensions: [],
  // Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
  watchFolders: [],
}).then((config) => {
  // Exclude node_modules from watch roots only on Linux (no watchman) or in Docker/CI
  // environments — the FallbackWatcher would try to register inotify watches for every
  // file under node_modules, exhausting the 240 s startup timeout.
  // On macOS watchman is used and node_modules must remain watched for SHA-1 computation.
  const isLinuxOrCI =
    process.platform === 'linux' ||
    process.env.CI === 'true' ||
    require('fs').existsSync('/.dockerenv');

  return {
    ...config,
    watchFolders: isLinuxOrCI
      ? config.watchFolders.filter(
          (folder) => !folder.includes(path.sep + 'node_modules'),
        )
      : config.watchFolders,
  };
});
