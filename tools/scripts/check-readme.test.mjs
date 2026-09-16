import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CHECKER = join(
  dirname(fileURLToPath(import.meta.url)),
  'check-readme.mjs',
);

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'check-readme-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  return workspace;
}

function writeReadme(workspace, diagramContent) {
  const readmePath = join(workspace, 'README.md');
  writeFileSync(
    readmePath,
    `# MyOrganizer\n\n\`\`\`\nmyorganizer/\n${diagramContent}\n\`\`\`\n`,
  );
}

function createDirectory(workspace, path) {
  mkdirSync(join(workspace, path), { recursive: true });
}

function runChecker(workspace) {
  return spawnSync(process.execPath, [CHECKER], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

test('passes when diagram and filesystem are in sync', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   ├── backend/',
    '│   └── myorganizer/',
    '├── libs/',
    '│   ├── core/',
    '│   └── auth/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'apps/myorganizer');
  createDirectory(workspace, 'libs/core');
  createDirectory(workspace, 'libs/auth');

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /assertions in sync/);
});

test('rejects a stale app entry in the diagram (reverse direction check)', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   ├── backend/',
    '│   ├── deleted-app/',
    '│   └── myorganizer/',
    '├── libs/',
    '│   └── core/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'apps/myorganizer');
  createDirectory(workspace, 'libs/core');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /layout diagram names apps\/deleted-app/);
  assert.match(result.stderr, /does not exist/);
});

test('rejects a stale lib entry in the diagram (reverse direction check)', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   └── backend/',
    '├── libs/',
    '│   ├── deleted-lib/',
    '│   └── core/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'libs/core');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /layout diagram names libs\/deleted-lib/);
  assert.match(result.stderr, /does not exist/);
});

test('rejects a missing app from the diagram (forward direction check)', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   └── backend/',
    '├── libs/',
    '│   └── core/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'apps/myorganizer');
  createDirectory(workspace, 'libs/core');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/myorganizer exists but is missing/);
});

test('rejects a missing lib from the diagram (forward direction check)', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   └── backend/',
    '├── libs/',
    '│   └── core/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'libs/core');
  createDirectory(workspace, 'libs/auth');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /libs\/auth exists but is missing/);
});

test('handles compound lib names like web/pages correctly', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   └── backend/',
    '├── libs/',
    '│   ├── core/',
    '│   └── web/pages/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'libs/core');
  createDirectory(workspace, 'libs/web/pages');

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /assertions in sync/);
});

test('respects ignore lists for stale entries', (t) => {
  const workspace = createWorkspace(t);
  const diagram = [
    '├── apps/',
    '│   ├── backend/',
    '│   └── graphify-out/',
    '├── libs/',
    '│   ├── core/',
    '│   └── graphify-out/',
    '└── tools/',
  ].join('\n');
  writeReadme(workspace, diagram);
  createDirectory(workspace, 'apps/backend');
  createDirectory(workspace, 'libs/core');

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
});
