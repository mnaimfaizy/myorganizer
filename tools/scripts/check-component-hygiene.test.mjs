import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CHECKER_SOURCE = join(SCRIPT_DIR, 'check-component-hygiene.mjs');
const SCAN_SOURCE = join(SCRIPT_DIR, 'lib', 'source-scan.mjs');

function writeFixture(workspace, relativePath, content) {
  const file = join(workspace, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return relativePath;
}

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'component-hygiene-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  writeFixture(
    workspace,
    'tools/scripts/check-component-hygiene.mjs',
    readFileSync(CHECKER_SOURCE, 'utf8'),
  );
  writeFixture(
    workspace,
    'tools/scripts/lib/source-scan.mjs',
    readFileSync(SCAN_SOURCE, 'utf8'),
  );

  return workspace;
}

function runChecker(workspace, ...args) {
  const checkerPath = join(
    workspace,
    'tools/scripts/check-component-hygiene.mjs',
  );
  return spawnSync(process.execPath, [checkerPath, ...args], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

function git(workspace, ...args) {
  return execFileSync('git', args, { cwd: workspace, encoding: 'utf8' });
}

function initializeRepository(workspace) {
  git(workspace, 'init', '--quiet');
  git(workspace, 'config', 'user.email', 'test@example.com');
  git(workspace, 'config', 'user.name', 'Test');
}

test('explicit feature fixture with warning exits 0 and reports warning in advisory mode', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, file);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /handler-not-memoized/);
  assert.match(result.stdout, /0 error\(s\), 1 warning\(s\)/);
});

test('feature fixture with warning exits 1 with --max-warnings=0 while retaining warning output', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--max-warnings=0', file);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /handler-not-memoized/);
  assert.match(result.stdout, /0 error\(s\), 1 warning\(s\)/);
});

test('strict JSON warning exits 1 and produces exact top-level keys', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', '--max-warnings=0', file);

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(parsed), ['errors', 'warnings', 'results']);
  assert.equal(parsed.errors, 0);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].file, file);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
});

test('error fixture exits 1 in advisory and strict modes', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ErrorComponent.tsx',
    [
      "import { Button } from '@myorganizer/web-ui/src/lib/components/button/Button';",
      '',
      'export function ErrorComponent() {',
      '  return <Button />;',
      '}',
      '',
    ].join('\n'),
  );

  const advisoryResult = runChecker(workspace, file);
  assert.equal(advisoryResult.status, 1);
  assert.match(advisoryResult.stdout, /deep-import/);

  const strictResult = runChecker(workspace, '--max-warnings=0', file);
  assert.equal(strictResult.status, 1);
  assert.match(strictResult.stdout, /deep-import/);
});

test('CLI misuse exits 2 and prints usage information', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.tsx',
    'export function Component() { return <div />; }\n',
  );

  const cases = [
    ['--unknown'],
    ['--max-warnings=1'],
    ['--all', '--staged'],
    ['--all', file],
    ['--staged', file],
  ];

  for (const args of cases) {
    const result = runChecker(workspace, ...args);
    assert.equal(
      result.status,
      2,
      `Expected exit code 2 for args: ${args.join(' ')}`,
    );
    assert.match(result.stderr, /Usage:/);
  }
});

test('empty staged selection exits 0 in text and JSON modes', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);
  writeFixture(workspace, 'README.md', '# Readme\n');
  git(workspace, 'add', 'README.md');

  const textResult = runChecker(workspace, '--staged');
  assert.equal(textResult.status, 0);
  assert.equal(textResult.stdout.trim(), 'No staged component files to check.');

  const jsonResult = runChecker(workspace, '--staged', '--json');
  assert.equal(jsonResult.status, 0);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.deepEqual(parsed, { errors: 0, warnings: 0, results: [] });
});

test('--staged inspects staged added/modified files and ignores unstaged files', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const modifiedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ModifiedComponent.tsx',
    'export function ModifiedComponent() { return <div />;\n }\n',
  );
  git(workspace, 'add', modifiedFile);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  writeFixture(
    workspace,
    modifiedFile,
    [
      "import * as React from 'react';",
      '',
      'export function ModifiedComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );
  git(workspace, 'add', modifiedFile);

  const addedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/AddedComponent.tsx',
    'export function AddedComponent() { return <div />; }\n',
  );
  git(workspace, 'add', addedFile);

  const unstagedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/UnstagedComponent.tsx',
    "import { Button } from '@myorganizer/web-ui/src/lib/components/button/Button';\nexport function UnstagedComponent() { return <Button />; }\n",
  );

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const resultFiles = parsed.results.map((r) => r.file);

  assert.ok(resultFiles.includes(addedFile));
  assert.ok(resultFiles.includes(modifiedFile));
  assert.equal(resultFiles.length, 2);
  assert.ok(!resultFiles.includes(unstagedFile));

  const modifiedResult = parsed.results.find((r) => r.file === modifiedFile);
  assert.ok(modifiedResult);
  assert.ok(
    modifiedResult.findings.some((f) => f.rule === 'handler-not-memoized'),
  );
});

test('--staged handles renamed files with spaces in destination path', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const oldPath = writeFixture(
    workspace,
    'libs/web/pages/todos/src/OldComponent.tsx',
    'export function OldComponent() { return <div />; }\n',
  );
  git(workspace, 'add', oldPath);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  const newPath = 'libs/web/pages/todos/src/New Component With Spaces.tsx';
  git(workspace, 'mv', oldPath, newPath);

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const resultFiles = parsed.results.map((r) => r.file);
  assert.deepEqual(resultFiles, [newPath]);
  assert.ok(!resultFiles.includes(oldPath));
});

test('--staged ignores deleted component files and out-of-scope files', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const componentPath = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ToDelete.tsx',
    'export function ToDelete() { return <div />; }\n',
  );
  git(workspace, 'add', componentPath);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  git(workspace, 'rm', componentPath);

  writeFixture(workspace, 'README.md', '# Readme\n');
  writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.test.tsx',
    "test('noop', () => {});\n",
  );
  writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.stories.tsx',
    'export default {};\n',
  );
  writeFixture(workspace, 'tools/scripts/something.js', 'console.log();\n');

  git(
    workspace,
    'add',
    'README.md',
    'libs/web/pages/todos/src/Component.test.tsx',
    'libs/web/pages/todos/src/Component.stories.tsx',
    'tools/scripts/something.js',
  );

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, { errors: 0, warnings: 0, results: [] });
  assert.doesNotMatch(result.stderr, /unreadable/);
});

test('--staged outside a Git repository fails with nonzero exit code', (t) => {
  const workspace = createWorkspace(t);

  const result = runChecker(workspace, '--staged');

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /No staged component files to check/);
});
