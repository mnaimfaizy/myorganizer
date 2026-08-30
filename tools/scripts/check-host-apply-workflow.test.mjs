/**
 * Contract for check-host-apply-workflow.mjs (ADR 0056, issue #567).
 *
 * The fixture is a copy of the real files rather than a hand-written miniature:
 * the checker's whole job is to read this repo's actual workflow shapes, and a
 * fixture that drifts from them would pass while the checker no longer reads
 * anything. Each negative case copies the real tree and then breaks one fact.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, 'check-host-apply-workflow.mjs');
const REPO = resolve(HERE, '..', '..');

const STAGING = '.github/workflows/deploy-staging.yml';
const PRODUCTION = '.github/workflows/deploy-production.yml';
const HOST_APPLY_LIB = 'tools/scripts/lib/host-apply.mjs';

const FIXTURE_FILES = [STAGING, PRODUCTION, HOST_APPLY_LIB];

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'host-apply-workflow-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  for (const file of FIXTURE_FILES) {
    const target = join(workspace, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(REPO, file), target);
  }
  return workspace;
}

const readFixture = (workspace, file) =>
  readFileSync(join(workspace, file), 'utf8');

const writeFixture = (workspace, file, content) =>
  writeFileSync(join(workspace, file), content);

/** Replaces one occurrence, asserting it was there — a no-op edit would fake a pass. */
function edit(workspace, file, from, to) {
  const before = readFixture(workspace, file);
  assert.ok(before.includes(from), `fixture no longer contains: ${from}`);
  writeFixture(workspace, file, before.replace(from, to));
}

function runChecker(workspace) {
  return spawnSync(process.execPath, [CHECKER, workspace], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

// ===== Happy Path =====

test('passes when the workflows match the contract', (t) => {
  const result = runChecker(createWorkspace(t));

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /wiring in sync/);
});

// ===== Environment Checks =====

test('fails when staging host-apply lacks environment: staging', (t) => {
  const workspace = createWorkspace(t);

  // The staging workflow has three job-level `environment: staging` declarations.
  // Target only the host-apply job's occurrence by finding its block.
  const stagingContent = readFixture(workspace, STAGING);
  const lines = stagingContent.split('\n');
  const hostApplyLineStart = lines.findIndex((line) =>
    line.startsWith('  host-apply:'),
  );
  const hostApplyLineEndIndex = lines.findIndex(
    (line, idx) =>
      idx > hostApplyLineStart &&
      line.match(/^  {2}[a-z0-9][a-z0-9-]*:/) &&
      !line.startsWith('  host-apply:'),
  );
  const hostApplyLineEnd =
    hostApplyLineEndIndex === -1 ? lines.length : hostApplyLineEndIndex;

  // Find environment line in this block and remove it
  for (let i = hostApplyLineStart; i < hostApplyLineEnd; i++) {
    if (
      lines[i].includes('environment:') &&
      lines[i].includes('staging') &&
      !lines[i].includes('deploy-staging')
    ) {
      lines.splice(i, 1);
      break;
    }
  }

  writeFixture(workspace, STAGING, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /host-apply does not declare environment: staging/,
  );
});

test('fails when production host-apply lacks environment: production', (t) => {
  const workspace = createWorkspace(t);

  const prodContent = readFixture(workspace, PRODUCTION);
  const lines = prodContent.split('\n');
  const hostApplyLineStart = lines.findIndex((line) =>
    line.startsWith('  host-apply:'),
  );
  const hostApplyLineEndIndex = lines.findIndex(
    (line, idx) =>
      idx > hostApplyLineStart &&
      line.match(/^  {2}[a-z0-9][a-z0-9-]*:/) &&
      !line.startsWith('  host-apply:'),
  );
  const hostApplyLineEnd =
    hostApplyLineEndIndex === -1 ? lines.length : hostApplyLineEndIndex;

  // Find and remove environment line in host-apply block
  for (let i = hostApplyLineStart; i < hostApplyLineEnd; i++) {
    if (lines[i].includes('environment:') && lines[i].includes('production')) {
      lines.splice(i, 1);
      break;
    }
  }

  writeFixture(workspace, PRODUCTION, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /host-apply does not declare environment: production/,
  );
});

// ===== Needs Checks =====

test('fails when staging host-apply needs does not include deploy-backend', (t) => {
  const workspace = createWorkspace(t);

  edit(
    workspace,
    STAGING,
    '  host-apply:\n    needs: deploy-backend',
    '  host-apply:\n    needs: deploy-frontend',
  );

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not include deploy-backend/);
});

test('fails when production host-apply needs does not include deploy-backend', (t) => {
  const workspace = createWorkspace(t);

  const prodContent = readFixture(workspace, PRODUCTION);
  const lines = prodContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes('host-apply:') &&
      lines[i + 1] &&
      lines[i + 1].includes('needs:')
    ) {
      // Found the host-apply needs line, change it
      lines[i + 1] = lines[i + 1].replace(/deploy-backend/, 'deploy-frontend');
      break;
    }
  }
  writeFixture(workspace, PRODUCTION, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not include deploy-backend/);
});

// ===== Dispatch Input Checks =====

test('fails when staging workflow_dispatch lacks apply_only input', (t) => {
  const workspace = createWorkspace(t);

  const stagingContent = readFixture(workspace, STAGING);
  const lines = stagingContent.split('\n');

  // Find and remove the apply_only input block
  let inDispatch = false;
  let applyOnlyStart = -1;
  let applyOnlyEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('workflow_dispatch:')) {
      inDispatch = true;
    } else if (inDispatch && lines[i].includes('apply_only:')) {
      applyOnlyStart = i;
      // Find the end of this input block (next input or end of dispatch)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^\s{6,8}[a-z_]+:\s*$/) || !lines[j].trim()) {
          applyOnlyEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (applyOnlyStart !== -1) {
    // Remove the block
    if (applyOnlyEnd === -1) applyOnlyEnd = applyOnlyStart + 1;
    lines.splice(applyOnlyStart, applyOnlyEnd - applyOnlyStart);
  }

  writeFixture(workspace, STAGING, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /declares no apply_only input/);
});

test('fails when production workflow_dispatch lacks apply_only input', (t) => {
  const workspace = createWorkspace(t);

  const prodContent = readFixture(workspace, PRODUCTION);
  const lines = prodContent.split('\n');

  let inDispatch = false;
  let applyOnlyStart = -1;
  let applyOnlyEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('workflow_dispatch:')) {
      inDispatch = true;
    } else if (inDispatch && lines[i].includes('apply_only:')) {
      applyOnlyStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^\s{6,8}[a-z_]+:\s*$/) || !lines[j].trim()) {
          applyOnlyEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (applyOnlyStart !== -1) {
    if (applyOnlyEnd === -1) applyOnlyEnd = applyOnlyStart + 1;
    lines.splice(applyOnlyStart, applyOnlyEnd - applyOnlyStart);
  }

  writeFixture(workspace, PRODUCTION, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /declares no apply_only input/);
});

// ===== Concurrency Checks =====

test('fails when staging host-apply cancel-in-progress is true', (t) => {
  const workspace = createWorkspace(t);

  edit(
    workspace,
    STAGING,
    'group: deploy-staging-host-apply\n      cancel-in-progress: false',
    'group: deploy-staging-host-apply\n      cancel-in-progress: true',
  );

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cancel-in-progress is true, expected false/);
});

test('fails when staging deploy-backend cancel-in-progress is false', (t) => {
  const workspace = createWorkspace(t);

  // The staging deploy-backend has cancel-in-progress: true, change it to false
  const stagingContent = readFixture(workspace, STAGING);
  const lines = stagingContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes('deploy-backend:') ||
      (i > 0 &&
        lines[i - 1].includes('deploy-backend:') &&
        lines[i].includes('concurrency:'))
    ) {
      // Found deploy-backend, look for its cancel-in-progress in the next few lines
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (
          lines[j].includes('cancel-in-progress:') &&
          lines[j].includes('true')
        ) {
          lines[j] = lines[j].replace('true', 'false');
          break;
        }
      }
      break;
    }
  }

  writeFixture(workspace, STAGING, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cancel-in-progress is false, expected true/);
});

// ===== Secret Allowlist Checks =====

test('fails when host-apply references a secret outside the allowlist', (t) => {
  const workspace = createWorkspace(t);

  const stagingContent = readFixture(workspace, STAGING);
  const lines = stagingContent.split('\n');

  // Find the host-apply job's env section and add a disallowed secret
  let hostApplyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('host-apply:')) {
      hostApplyStart = i;
      break;
    }
  }

  if (hostApplyStart !== -1) {
    // Find a step within host-apply and add env with disallowed secret
    for (let i = hostApplyStart; i < lines.length; i++) {
      if (lines[i].includes('run:') || lines[i].match(/^\s{8}run:/)) {
        // Insert env before this run statement
        lines.splice(
          i,
          0,
          '        env:',
          '          DISALLOWED_SECRET: ${{ secrets.NOT_IN_ALLOWLIST }}',
        );
        break;
      }
    }
  }

  writeFixture(workspace, STAGING, lines.join('\n'));

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /references secrets\.NOT_IN_ALLOWLIST.*not in HOST_APPLY_SECRET_NAMES/,
  );
});

test('fails when host-apply never references a required secret in the allowlist', (t) => {
  const workspace = createWorkspace(t);

  edit(
    workspace,
    STAGING,
    '          SELECTOR_APP_KEY: ${{ secrets.SELECTOR_APP_KEY }}\n',
    '',
  );

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /host-apply never references secrets\.SELECTOR_APP_KEY, which HOST_APPLY_SECRET_NAMES requires/,
  );
});

// ===== DATABASE_URL Secret Check =====

test('fails when DATABASE_URL appears as a secret anywhere in the file', (t) => {
  const workspace = createWorkspace(t);

  // Add a reference to secrets.DATABASE_URL anywhere in the file
  const stagingContent = readFixture(workspace, STAGING);
  const insertPoint = stagingContent.indexOf('workflow_dispatch:');
  const beforeInsert = stagingContent.slice(0, insertPoint);
  const afterInsert = stagingContent.slice(insertPoint);

  const modified =
    beforeInsert +
    'env:\n  DATABASE_SAFETY_CHECK: ${{ secrets.DATABASE_URL }}\n' +
    afterInsert;

  writeFixture(workspace, STAGING, modified);

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /references secrets\.DATABASE_URL.*must never be a GitHub secret/,
  );
});
