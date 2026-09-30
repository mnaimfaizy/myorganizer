import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requireBackendBuild,
  spawnBackendMain,
} from './lib/spawn-backend-main.mjs';

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const mainPath = resolve(workspaceRoot, 'dist', 'apps', 'backend', 'main.js');

requireBackendBuild(mainPath);

spawnBackendMain(mainPath, {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
});
