#!/usr/bin/env node
/**
 * Boots the API for the live logout Playwright spec (issue #831).
 *
 * Migrates, upserts one verified user, then serves the built backend with
 * NODE_ENV=development so the refresh cookie is not Secure — the suite talks
 * to the API over http://localhost. Playwright starts this only when
 * E2E_LIVE_BACKEND=1.
 *
 * Requires `yarn build:backend` first (the CI E2E job builds it). Loads the
 * repo `.env` without overriding variables already set, so CI's DATABASE_URL
 * and JWT secrets win.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { config: loadEnv } = require('dotenv');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const mainPath = resolve(workspaceRoot, 'dist', 'apps', 'backend', 'main.js');
const backendSrc = resolve(workspaceRoot, 'apps', 'backend', 'src');
const prismaCli = resolve(
  workspaceRoot,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

loadEnv({ path: resolve(workspaceRoot, '.env') });

const email = process.env.E2E_LIVE_AUTH_EMAIL;
const password = process.env.E2E_LIVE_AUTH_PASSWORD;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!email || !password) {
  fail(
    'E2E_LIVE_AUTH_EMAIL and E2E_LIVE_AUTH_PASSWORD are required. Playwright sets them from liveAuth.ts.',
  );
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required to migrate and seed the live logout user.');
}

if (!existsSync(mainPath)) {
  fail(
    `Backend build output not found at: ${mainPath}\nRun: yarn build:backend`,
  );
}

function run(executable, args, options) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${executable} exited ${code}`));
    });
  });
}

async function seedVerifiedUser() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        email_verification_timestamp: new Date(),
        email_verification_token: null,
        disabled: false,
      },
      create: {
        email,
        password: hashedPassword,
        first_name: 'Logout',
        last_name: 'E2E',
        name: 'Logout E2E',
        email_verification_timestamp: new Date(),
        blacklisted_tokens: [],
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

await run(
  process.execPath,
  [prismaCli, 'migrate', 'deploy', '--schema', 'prisma/schema'],
  { cwd: backendSrc, env: process.env },
);
await seedVerifiedUser();

const child = spawn(process.execPath, [mainPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: process.env.PORT || '3000',
  },
});

function stop() {
  child.kill();
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
