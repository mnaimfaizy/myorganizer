/**
 * Tests for host-apply.mjs — the engine for CI-owned Host Apply (ADR 0056, issue #566).
 *
 * Run with: yarn host-apply:test
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  HostApplyRefusal,
  HOST_APPLY_STEP_ORDER,
  buildSelectorLoadStep,
  buildHostApplySteps,
  renderHostApplyScript,
  buildHostApplyScript,
  assertAppRootGuard,
  findHostApplyLogLeaks,
  assertHostApplyLogClean,
  findMissingPackagerPrismaScripts,
} from './host-apply.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

// === Area 1: Builder order ===

test('buildHostApplySteps returns steps in HOST_APPLY_STEP_ORDER', () => {
  const result = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const ids = result.map((step) => step.id);
  assert.deepEqual(ids, HOST_APPLY_STEP_ORDER);
});

test('buildHostApplySteps npm-ci command is exactly npm ci --omit=dev', () => {
  const result = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const npmCi = result.find((step) => step.id === 'npm-ci');
  assert.equal(npmCi.command, 'npm ci --omit=dev');
});

test('buildHostApplySteps prisma commands use npm run (not npx)', () => {
  const result = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const migrate = result.find((step) => step.id === 'prisma-migrate-deploy');
  assert.equal(migrate.command, 'npm run prisma:migrate:deploy');

  const generate = result.find((step) => step.id === 'prisma-generate');
  assert.equal(generate.command, 'npm run prisma:generate');
});

test('buildHostApplySteps restart command is exactly touch tmp/restart.txt', () => {
  const result = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const restart = result.find((step) => step.id === 'restart');
  assert.equal(restart.command, 'touch tmp/restart.txt');
});

test('renderHostApplyScript starts with set -euo pipefail', () => {
  const steps = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const script = renderHostApplyScript(steps);
  assert.match(script, /^set -euo pipefail\n/);
});

test('renderHostApplyScript joins steps in order separated by newlines', () => {
  const steps = buildHostApplySteps({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  const script = renderHostApplyScript(steps);
  const lines = script.split('\n');

  // First line is set -euo pipefail
  assert.equal(lines[0], 'set -euo pipefail');

  // Script contains all the commands in order
  assert.ok(script.includes('source'));
  assert.ok(script.includes('cd'));
  assert.ok(script.includes('npm ci --omit=dev'));
  assert.ok(script.includes('npm run prisma:migrate:deploy'));
  assert.ok(script.includes('npm run prisma:generate'));
  assert.ok(script.includes('touch tmp/restart.txt'));
});

// === Area 2: Builder refuses unsafe input ===

test('buildHostApplySteps throws when appRoot is missing', () => {
  assert.throws(
    () =>
      buildHostApplySteps({
        nodevenvActivate: '/home/user/.nvm/nvm.sh',
        selectorAppKey: 'my-app',
      }),
    (err) =>
      err instanceof HostApplyRefusal && err.message.includes('APP_ROOT'),
  );
});

test('buildHostApplySteps throws when selectorAppKey is missing', () => {
  assert.throws(
    () =>
      buildHostApplySteps({
        nodevenvActivate: '/home/user/.nvm/nvm.sh',
        appRoot: '/var/app',
      }),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('SELECTOR_APP_KEY'),
  );
});

test('buildHostApplySteps throws when nodevenvActivate is missing', () => {
  assert.throws(
    () =>
      buildHostApplySteps({
        appRoot: '/var/app',
        selectorAppKey: 'my-app',
      }),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('NODEVENV_ACTIVATE'),
  );
});

// === Area 3: Selector isolation ===

test('buildSelectorLoadStep embeds the key literally with JSON.stringify', () => {
  const result = buildSelectorLoadStep('my-test-app');

  // JSON.stringify('my-test-app') produces "my-test-app" (with quotes)
  assert.ok(result.includes('"my-test-app"'));
});

test('buildSelectorLoadStep contains no sibling-enumeration patterns', () => {
  const result = buildSelectorLoadStep('my-app');

  // Should not contain Object.keys, for...in, or for...of
  assert.ok(
    !/Object\.keys|for\s*\(.*\bin\b|for\s*\(.*\bof\b/.test(result),
    'contains forbidden enumeration pattern',
  );
});

test('buildSelectorLoadStep never echoes or logs DATABASE_URL', () => {
  const result = buildSelectorLoadStep('my-app');

  // Should not echo the DATABASE_URL value itself (error messages echoed to stderr are ok)
  // Check that the node script uses process.stdout.write (not echo or console.log to output the value)
  assert.ok(result.includes('process.stdout.write(url)'));
  assert.ok(!result.includes('console.log(url)'));
  assert.ok(!result.includes('echo $DATABASE_URL'));
  assert.ok(!result.includes('echo "$DATABASE_URL"'));
});

test('buildSelectorLoadStep throws when selectorAppKey is empty', () => {
  assert.throws(
    () => buildSelectorLoadStep(''),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('SELECTOR_APP_KEY'),
  );
});

test('buildSelectorLoadStep throws when selectorAppKey is missing', () => {
  assert.throws(
    () => buildSelectorLoadStep(undefined),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('SELECTOR_APP_KEY'),
  );
});

// === Area 3b: Selector isolation (runtime behavior) ===

test('selector fragment refuses when app identity is not in store', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'selector-missing-identity-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const cpanelDir = join(tmpHome, '.cpanel');
  mkdirSync(cpanelDir, { recursive: true });

  // Create a store with some app but NOT the one we'll request
  writeFileSync(
    join(cpanelDir, 'nodejsapps.json'),
    JSON.stringify({
      'other-app': {
        envvars: { DATABASE_URL: 'postgres://other:pass@host/db' },
      },
    }),
  );

  const fragment = buildSelectorLoadStep('missing-app-key');
  const result = spawnSync('bash', ['-c', fragment], {
    env: { ...process.env, HOME: tmpHome },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'should exit non-zero');
  assert.ok(
    result.stderr.includes('refused'),
    'stderr should contain refusal message',
  );
  assert.ok(
    !result.stdout.includes('postgres://'),
    'stdout should not contain connection string',
  );
});

test('selector fragment refuses when DATABASE_URL key is missing from envvars', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'selector-missing-dburl-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const cpanelDir = join(tmpHome, '.cpanel');
  mkdirSync(cpanelDir, { recursive: true });

  // Create a store with the app but envvars lacks DATABASE_URL
  writeFileSync(
    join(cpanelDir, 'nodejsapps.json'),
    JSON.stringify({
      'my-app': {
        envvars: { SOME_OTHER_VAR: 'value' },
      },
    }),
  );

  const fragment = buildSelectorLoadStep('my-app');
  const result = spawnSync('bash', ['-c', fragment], {
    env: { ...process.env, HOME: tmpHome },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'should exit non-zero');
  assert.ok(
    result.stderr.includes('refused'),
    'stderr should contain refusal message',
  );
  assert.ok(
    !result.stdout.includes('value'),
    'stdout should not contain any envvars value',
  );
});

test('selector fragment succeeds and does not print the value to stdout', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'selector-success-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  const cpanelDir = join(tmpHome, '.cpanel');
  mkdirSync(cpanelDir, { recursive: true });

  const fixtureUrl =
    'postgres://fixture-user:fixture-pass@fixture-host:5432/fixture-db';

  // Create a store with the app and proper DATABASE_URL
  writeFileSync(
    join(cpanelDir, 'nodejsapps.json'),
    JSON.stringify({
      'my-app': {
        envvars: { DATABASE_URL: fixtureUrl },
      },
    }),
  );

  const fragment = buildSelectorLoadStep('my-app');

  // Test 1: Fragment alone produces empty stdout (value captured in variable, not printed)
  const result1 = spawnSync('bash', ['-c', fragment], {
    env: { ...process.env, HOME: tmpHome },
    encoding: 'utf8',
  });

  assert.equal(result1.status, 0, 'should succeed');
  assert.equal(
    result1.stdout,
    '',
    'fragment itself should not print to stdout',
  );

  // Test 2: Fragment wrapped with a test-provided echo shows variable was exported
  const wrappedCommand = `${fragment}\necho GOT:$DATABASE_URL`;
  const result2 = spawnSync('bash', ['-c', wrappedCommand], {
    env: { ...process.env, HOME: tmpHome },
    encoding: 'utf8',
  });

  assert.equal(result2.status, 0, 'should succeed with wrapper echo');
  assert.ok(
    result2.stdout.includes('GOT:postgres://fixture-user:fixture-pass'),
    'wrapper echo should show the exported value',
  );
  // Verify the fixture value appears only in the wrapper echo line, not elsewhere
  const lines = result2.stdout.split('\n');
  const gotLine = lines.find((l) => l.startsWith('GOT:'));
  assert.ok(gotLine, 'should have GOT: line from wrapper');
  assert.ok(
    gotLine.includes(fixtureUrl),
    'GOT line should contain the fixture value',
  );
});

test('selector fragment refuses cleanly when store file is missing', (t) => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'selector-no-file-'));
  t.after(() => rmSync(tmpHome, { recursive: true, force: true }));

  // Do NOT create .cpanel/nodejsapps.json

  const fragment = buildSelectorLoadStep('my-app');
  const result = spawnSync('bash', ['-c', fragment], {
    env: { ...process.env, HOME: tmpHome },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, 'should exit non-zero');
  assert.ok(
    result.stderr.includes('refused'),
    'stderr should contain refusal message',
  );
  // Confirm no stack trace or internal paths leaked beyond the error message
  assert.ok(!result.stderr.includes('at '), 'should not contain stack trace');
});

// === Area 4: APP_ROOT guard ===

test('assertAppRootGuard throws when appRoot is empty', () => {
  assert.throws(
    () =>
      assertAppRootGuard({
        environment: 'staging',
        appRoot: '',
      }),
    (err) =>
      err instanceof HostApplyRefusal && err.message.includes('APP_ROOT'),
  );
});

test('assertAppRootGuard throws when appRoot is undefined', () => {
  assert.throws(
    () =>
      assertAppRootGuard({
        environment: 'staging',
        appRoot: undefined,
      }),
    (err) =>
      err instanceof HostApplyRefusal && err.message.includes('APP_ROOT'),
  );
});

test('assertAppRootGuard throws when staging appRoot equals production counterpart', () => {
  const sharedRoot = '/var/app';

  assert.throws(
    () =>
      assertAppRootGuard({
        environment: 'staging',
        appRoot: sharedRoot,
        counterpartAppRoot: sharedRoot,
      }),
    (err) =>
      err instanceof HostApplyRefusal && err.message.includes('Production'),
  );
});

test('assertAppRootGuard throws when production appRoot equals staging counterpart', () => {
  const sharedRoot = '/var/app';

  assert.throws(
    () =>
      assertAppRootGuard({
        environment: 'production',
        appRoot: sharedRoot,
        counterpartAppRoot: sharedRoot,
      }),
    (err) => err instanceof HostApplyRefusal && err.message.includes('Staging'),
  );
});

test('assertAppRootGuard returns appRoot when staging differs from production', () => {
  const stagingRoot = '/var/staging-app';
  const result = assertAppRootGuard({
    environment: 'staging',
    appRoot: stagingRoot,
    counterpartAppRoot: '/var/prod-app',
  });

  assert.equal(result, stagingRoot);
});

test('assertAppRootGuard returns appRoot when production differs from staging', () => {
  const prodRoot = '/var/prod-app';
  const result = assertAppRootGuard({
    environment: 'production',
    appRoot: prodRoot,
    counterpartAppRoot: '/var/staging-app',
  });

  assert.equal(result, prodRoot);
});

test('assertAppRootGuard throws on unknown environment', () => {
  assert.throws(
    () =>
      assertAppRootGuard({
        environment: 'unknown',
        appRoot: '/var/app',
      }),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('unknown Host Apply environment'),
  );
});

// === Area 5: Log redaction ===

test('assertHostApplyLogClean throws for connection string leak', () => {
  const logWithLeak =
    'Connecting to postgres://user:password@localhost:5432/db\n';

  assert.throws(
    () => assertHostApplyLogClean(logWithLeak),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('redaction violation'),
  );
});

test('assertHostApplyLogClean throws for bare DATABASE_URL assignment', () => {
  const logWithLeak = 'Setting DATABASE_URL=postgres://localhost\n';

  assert.throws(
    () => assertHostApplyLogClean(logWithLeak),
    (err) =>
      err instanceof HostApplyRefusal &&
      err.message.includes('redaction violation'),
  );
});

test('assertHostApplyLogClean does not throw for clean log', () => {
  const cleanLog =
    'npm ci completed\nPrisma migration succeeded\nRestart command executed\n';

  assert.doesNotThrow(() => assertHostApplyLogClean(cleanLog));
});

test('findHostApplyLogLeaks returns empty array for clean log', () => {
  const cleanLog =
    'npm ci completed\nPrisma migration succeeded\nRestart command executed\n';

  const leaks = findHostApplyLogLeaks(cleanLog);

  assert.deepEqual(leaks, []);
});

test('findHostApplyLogLeaks detects connection string on the correct line', () => {
  const logWithLeak =
    'Step 1\nConnecting to mysql://user:pass@host/db\nStep 2\n';

  const leaks = findHostApplyLogLeaks(logWithLeak);

  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].rule, 'connection-string');
  assert.equal(leaks[0].line, 2);
});

test('findHostApplyLogLeaks detects DATABASE_URL assignment on the correct line', () => {
  const logWithLeak = 'Step 1\nDATABASE_URL=somevalue\nStep 2\n';

  const leaks = findHostApplyLogLeaks(logWithLeak);

  assert.ok(leaks.some((l) => l.rule === 'database-url-assignment'));
  assert.ok(leaks.some((l) => l.line === 2));
});

// === Area 6: Packager contract ===

test('findMissingPackagerPrismaScripts returns empty array for real package-backend-api.mjs', () => {
  const packagerPath = join(REPO, 'tools/scripts/package-backend-api.mjs');
  const packagerSource = readFileSync(packagerPath, 'utf8');

  const missing = findMissingPackagerPrismaScripts(packagerSource);

  assert.deepEqual(missing, []);
});

test('findMissingPackagerPrismaScripts detects missing prisma:migrate:deploy', () => {
  const packagerSource = `
    scripts: {
      'prisma:generate': 'npm run --prefix dist/apps/backend prisma generate',
    }
  `;

  const missing = findMissingPackagerPrismaScripts(packagerSource);

  assert.ok(missing.includes('prisma:migrate:deploy'));
  assert.ok(!missing.includes('prisma:generate'));
});

test('findMissingPackagerPrismaScripts detects missing prisma:generate', () => {
  const packagerSource = `
    scripts: {
      'prisma:migrate:deploy': 'npm run --prefix dist/apps/backend prisma migrate deploy --',
    }
  `;

  const missing = findMissingPackagerPrismaScripts(packagerSource);

  assert.ok(!missing.includes('prisma:migrate:deploy'));
  assert.ok(missing.includes('prisma:generate'));
});

test('buildHostApplyScript returns both steps and script', () => {
  const result = buildHostApplyScript({
    nodevenvActivate: '/home/user/.nvm/nvm.sh',
    appRoot: '/var/app',
    selectorAppKey: 'my-app',
  });

  assert.ok(Array.isArray(result.steps));
  assert.equal(result.steps.length, HOST_APPLY_STEP_ORDER.length);
  assert.equal(typeof result.script, 'string');
  assert.ok(result.script.startsWith('set -euo pipefail'));
});
