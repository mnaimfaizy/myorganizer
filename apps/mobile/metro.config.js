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
  cacheVersion: 'mobile-rn-react-pin',
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
  },
};

/**
 * React Native 0.79 ships a renderer compiled against React 19.0.0. The
 * workspace hoists React 19.2.3 for Next.js, and React 19.1+ throws if the
 * two versions differ. Pin Metro to the matching copy (`react-for-native`)
 * unless the hoisted `react` already matches the renderer.
 *
 * Read the renderer version from the file RN ships, not from memory: an RN
 * upgrade that syncs a newer renderer must fail here until the pin moves.
 */
function readNativeRendererVersion() {
  const rendererPath = path.join(
    path.dirname(require.resolve('react-native')),
    'Libraries/Renderer/implementations/ReactNativeRenderer-prod.js',
  );
  const source = fs.readFileSync(rendererPath, 'utf8');
  const match = source.match(/react-native-renderer:\s+([\d.]+)/);
  if (!match) {
    throw new Error(
      'Could not read react-native-renderer version from React Native.',
    );
  }
  return match[1];
}

function resolveExportTarget(entry) {
  if (!entry) {
    return null;
  }
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry.default === 'string') {
    return entry.default;
  }
  if (typeof entry.require === 'string') {
    return entry.require;
  }
  return null;
}

function resolveReactFile(pinnedDir, moduleName) {
  const pkg = require(path.join(pinnedDir, 'package.json'));
  const subpath =
    moduleName === 'react' ? '.' : `./${moduleName.slice('react/'.length)}`;
  if (subpath === './package.json') {
    return path.join(pinnedDir, 'package.json');
  }
  const target = resolveExportTarget(pkg.exports?.[subpath]);
  if (target) {
    return path.join(pinnedDir, target);
  }
  if (moduleName === 'react' && pkg.main) {
    return path.join(pinnedDir, pkg.main);
  }
  throw new Error(
    `Cannot resolve ${moduleName} inside pinned React ${pkg.version} at ${pinnedDir}`,
  );
}

function resolvePinnedReactDir(rendererVersion) {
  const hoistedVersion = require('react/package.json').version;
  if (hoistedVersion === rendererVersion) {
    return null;
  }
  let pinnedPkg;
  try {
    pinnedPkg = require.resolve('react-for-native/package.json');
  } catch {
    throw new Error(
      `React Native ships renderer ${rendererVersion}, but workspace react is ${hoistedVersion}. Install react-for-native@npm:react@${rendererVersion} so Metro can pin the matching copy.`,
    );
  }
  const pinnedVersion = require(pinnedPkg).version;
  if (pinnedVersion !== rendererVersion) {
    throw new Error(
      `react-for-native is ${pinnedVersion} but the React Native renderer is ${rendererVersion}. Pin react-for-native to npm:react@${rendererVersion}.`,
    );
  }
  return path.dirname(pinnedPkg);
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

  const rendererVersion = readNativeRendererVersion();
  const pinnedReactDir = resolvePinnedReactDir(rendererVersion);
  const previousResolveRequest = config.resolver.resolveRequest;

  return {
    ...config,
    watchFolders: isLinuxOrCI
      ? config.watchFolders.filter(
          (folder) => !folder.includes(path.sep + 'node_modules'),
        )
      : config.watchFolders,
    resolver: {
      ...config.resolver,
      extraNodeModules: {
        ...(config.resolver.extraNodeModules || {}),
        ...(pinnedReactDir ? { react: pinnedReactDir } : {}),
      },
      resolveRequest: pinnedReactDir
        ? (context, moduleName, platform) => {
            if (moduleName === 'react' || moduleName.startsWith('react/')) {
              return {
                type: 'sourceFile',
                filePath: resolveReactFile(pinnedReactDir, moduleName),
              };
            }
            return previousResolveRequest(context, moduleName, platform);
          }
        : previousResolveRequest,
    },
  };
});
