import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const extensions = [
  '.mjs',
  '.web.tsx',
  '.tsx',
  '.web.ts',
  '.ts',
  '.web.jsx',
  '.jsx',
  '.web.js',
  '.js',
  '.css',
  '.json',
];

const rollupPlugin = (matchers: RegExp[]) => ({
  name: 'js-in-jsx',
  load(id: string) {
    if (matchers.some((matcher) => matcher.test(id)) && id.endsWith('.js')) {
      const file = readFileSync(id, { encoding: 'utf-8' });
      return esbuild.transformSync(file, { loader: 'jsx', jsx: 'automatic' });
    }
  },
});

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/mobile',
  define: {
    global: 'window',
  },
  resolve: {
    extensions,
    alias: {
      'react-native': 'react-native-web',
      'react-native-svg': 'react-native-svg-web',
      '@react-native/assets-registry/registry':
        'react-native-web/dist/modules/AssetRegistry/index',
    },
  },
  build: {
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    outDir: '../../dist/apps/mobile/web',
    rollupOptions: {
      // Packages that publish JSX inside `.js` files. Rollup parses `.js` as
      // plain JavaScript, so each one is named here or the web build fails
      // on its first `<`; `optimizeDeps` covers the same case for dev only.
      plugins: [
        rollupPlugin([/react-native-vector-icons/, /react-native-reanimated/]),
      ],
    },
  },
  server: {
    port: 4200,
    host: 'localhost',
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: extensions,
      jsx: 'automatic',
      loader: { '.js': 'jsx' },
    },
  },
  plugins: [
    // Reanimated's worklets are compiled by its Babel plugin, on the web
    // exactly as on a device: without it a `useAnimatedStyle` throws when it
    // is called rather than failing to build.
    react({ babel: { plugins: ['react-native-reanimated/plugin'] } }),
    nxViteTsPaths(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
});
