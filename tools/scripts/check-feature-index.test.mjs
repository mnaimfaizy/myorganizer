import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CHECKER = join(
  dirname(fileURLToPath(import.meta.url)),
  'check-feature-index.mjs',
);

const FEATURE_INDEX = join('docs', 'features', 'README.md');
const DASHBOARD_ROOT = join('apps', 'myorganizer', 'src', 'app', 'dashboard');

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'feature-index-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  return workspace;
}

function writeFeatureIndex(workspace, rows) {
  const path = join(workspace, FEATURE_INDEX);
  mkdirSync(dirname(path), { recursive: true });
  const table = [
    '| Feature | Status | Vault-backed | Docs |',
    '| ------- | ------ | ------------ | ---- |',
    ...rows.map((name) => `| ${name} | ✅ | Yes | — |`),
  ].join('\n');
  writeFileSync(
    path,
    `# Feature documentation\n\n## Features Index\n\n${table}\n`,
  );
}

function writeDashboardRoute(workspace, slug) {
  const path = join(workspace, DASHBOARD_ROOT, slug, 'page.tsx');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'export default function Page() { return null; }\n');
}

function runChecker(workspace) {
  return spawnSync(process.execPath, [CHECKER, FEATURE_INDEX, DASHBOARD_ROOT], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

test('accepts a feature index whose rows resolve to real routes', (t) => {
  const workspace = createWorkspace(t);
  writeFeatureIndex(workspace, ['Tasks', 'Mobile Numbers']);
  writeDashboardRoute(workspace, 'tasks');
  writeDashboardRoute(workspace, 'mobile-numbers');

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 feature\(s\) indexed/);
});

test('rejects a stale entry naming a route the app router no longer serves', (t) => {
  const workspace = createWorkspace(t);
  writeFeatureIndex(workspace, ['Tasks', 'Todo']);
  writeDashboardRoute(workspace, 'tasks');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /"Todo"/);
  assert.match(result.stderr, /\/dashboard\/todo/);
});

test('a real route with no feature index entry does not fail', (t) => {
  const workspace = createWorkspace(t);
  writeFeatureIndex(workspace, ['Tasks']);
  writeDashboardRoute(workspace, 'tasks');
  writeDashboardRoute(workspace, 'account');

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
});

test('cannot run when the feature index is missing', (t) => {
  const workspace = createWorkspace(t);
  writeDashboardRoute(workspace, 'tasks');

  const result = runChecker(workspace);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/);
});

test('cannot run when the dashboard root is missing', (t) => {
  const workspace = createWorkspace(t);
  writeFeatureIndex(workspace, ['Tasks']);

  const result = runChecker(workspace);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/);
});

test('cannot run when the feature index has no Features Index section', (t) => {
  const workspace = createWorkspace(t);
  writeDashboardRoute(workspace, 'tasks');
  const path = join(workspace, FEATURE_INDEX);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '# Feature documentation\n\nNo table here.\n');

  const result = runChecker(workspace);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Features Index/);
});
