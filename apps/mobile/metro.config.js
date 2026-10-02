const { withNxMetro } = require('@nx/react-native');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const fs = require('fs');
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
  cacheVersion: 'mobile-rn-0.87',
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
  },
};

/**
 * React Native ships a renderer compiled against one exact React version, and
 * React throws at runtime if the `react` it is given differs. React Native
 * 0.87 and the workspace both sit on the same version, so Metro resolves the
 * hoisted `react` and no alias is needed.
 *
 * The workspace `react` moves with Next.js, though, so the pair can drift
 * again. Read the renderer version from the file React Native ships, not from
 * memory, and fail the bundle here rather than on a device.
 */
function assertReactMatchesNativeRenderer() {
  const rendererPath = path.join(
    path.dirname(require.resolve('react-native')),
    'Libraries/Renderer/implementations/ReactFabric-prod.js',
  );
  const source = fs.readFileSync(rendererPath, 'utf8');
  const match = source.match(/reconcilerVersion:\s+"([\d.]+)"/);
  if (!match) {
    throw new Error('Could not read the renderer version from React Native.');
  }
  const rendererVersion = match[1];
  const hoistedVersion = require('react/package.json').version;
  if (hoistedVersion !== rendererVersion) {
    throw new Error(
      `React Native ships renderer ${rendererVersion}, but workspace react is ${hoistedVersion}. Move React Native to a release whose renderer matches, or alias a matching react for Metro.`,
    );
  }
}

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
    fs.existsSync('/.dockerenv');

  assertReactMatchesNativeRenderer();

  return {
    ...config,
    watchFolders: isLinuxOrCI
      ? config.watchFolders.filter(
          (folder) => !folder.includes(path.sep + 'node_modules'),
        )
      : config.watchFolders,
  };
});
