import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspaceRoot = resolve(__dirname, '..', '..');
const mainPath = resolve(workspaceRoot, 'dist', 'apps', 'backend', 'main.js');

if (!existsSync(mainPath)) {
  console.error(`Backend build output not found at: ${mainPath}`);
  console.error('Run: yarn build:backend');
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

const child = spawn(process.execPath, [mainPath], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
