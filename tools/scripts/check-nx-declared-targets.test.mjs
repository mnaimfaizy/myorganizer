// Contracts for check-nx-declared-targets.mjs's command-line surface,
// following check-gate-coverage.test.mjs's shape: the checker runs as a real
// subprocess against a miniature git repository, because it reads tracked
// project.json files with `git ls-files` the same way
// check-mobile-platform.mjs and check-nx-project-tags.mjs read their corpus.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const CHECKER = join(HERE, 'check-nx-declared-targets.mjs');

function createRepo(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'nx-declared-targets-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: workspace, stdio: 'ignore' });
  return workspace;
}

function write(workspace, relative, contents) {
  const path = join(workspace, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
  );
}

function writeBaseline(workspace, baseline, overrides = {}) {
  write(workspace, 'tools/config/nx-declared-targets-baseline.json', {
    schemaVersion: 1,
    comment: 'fixture baseline',
    baseline,
    ...overrides,
  });
}

function commitAll(workspace) {
  execFileSync('git', ['add', '-A'], { cwd: workspace, stdio: 'ignore' });
}

const run = (workspace, ...args) =>
  spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: workspace,
    encoding: 'utf8',
  });

/** A workspace carrying a baseline plus the given project.json files. */
function scaffold(t, projects = {}, baseline = []) {
  const workspace = createRepo(t);
  writeBaseline(workspace, baseline);
  for (const [path, json] of Object.entries(projects)) {
    write(workspace, path, json);
  }
  commitAll(workspace);
  return workspace;
}

test('exits 0 against the real repository with the committed 7-entry baseline', () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(
    result.stdout,
    /OK — 7 @nx\/\* Declared Target\(s\) match the 7-entry baseline/,
  );
});

test('passes when project.json targets exactly match the baseline', (t) => {
  const workspace = scaffold(
    t,
    {
      'libs/x/project.json': {
        name: 'x',
        targets: {
          lint: { executor: '@nx/eslint:lint' },
          test: { executor: '@nx/jest:jest' },
        },
      },
    },
    [
      { project: 'x', target: 'lint', executor: '@nx/eslint:lint' },
      { project: 'x', target: 'test', executor: '@nx/jest:jest' },
    ],
  );
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /2 @nx\/\* Declared Target\(s\) match the 2-entry baseline/,
  );
});

test('fails a new @nx/* executor target absent from the baseline, naming project, target, and executor', (t) => {
  const workspace = scaffold(t, {
    'libs/x/project.json': {
      name: 'x',
      targets: {
        lint: { executor: '@nx/eslint:lint' },
      },
    },
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /x: target `lint` declares executor `@nx\/eslint:lint`, which is not in the baseline/,
  );
});

test('fails a baseline entry with no matching target as stale', (t) => {
  const workspace = scaffold(
    t,
    {
      'libs/x/project.json': { name: 'x', targets: {} },
    },
    [{ project: 'x', target: 'lint', executor: '@nx/eslint:lint' }],
  );
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /baseline entry x `lint` \(@nx\/eslint:lint\) has no matching target/,
  );
});

test('a target switching executor reports one stale entry and one new entry, not a silent substitution', (t) => {
  const workspace = scaffold(
    t,
    {
      'libs/x/project.json': {
        name: 'x',
        targets: { lint: { executor: '@nx/eslint:lint' } },
      },
    },
    [{ project: 'x', target: 'lint', executor: '@nx/jest:jest' }],
  );
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /x: target `lint` declares executor `@nx\/eslint:lint`/,
  );
  assert.match(
    result.stderr,
    /baseline entry x `lint` \(@nx\/jest:jest\) has no matching target/,
  );
});

test('does not report an nx:run-commands target', (t) => {
  const workspace = scaffold(t, {
    'libs/x/project.json': {
      name: 'x',
      targets: {
        build: { executor: 'nx:run-commands', options: { command: 'echo hi' } },
      },
    },
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('does not report a third-party executor outside the @nx/ namespace', (t) => {
  const workspace = scaffold(t, {
    'libs/api-specs/project.json': {
      name: 'api-specs',
      targets: {
        generate: { executor: '@driimus/nx-plugin-openapi:generate' },
      },
    },
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('does not report a target that declares options or dependsOn with no executor', (t) => {
  const workspace = scaffold(t, {
    'libs/x/project.json': {
      name: 'x',
      targets: {
        test: {
          dependsOn: ['generate-types'],
          options: { passWithNoTests: true },
        },
      },
    },
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('exits 2 when the baseline is missing entirely', (t) => {
  const workspace = createRepo(t);
  write(workspace, 'libs/x/project.json', { name: 'x', targets: {} });
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/);
});

test('exits 2 when the baseline is not valid JSON', (t) => {
  const workspace = createRepo(t);
  write(
    workspace,
    'tools/config/nx-declared-targets-baseline.json',
    '{ not json',
  );
  write(workspace, 'libs/x/project.json', { name: 'x', targets: {} });
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not valid JSON/);
});

test('exits 2 when the baseline has the wrong schema version', (t) => {
  const workspace = createRepo(t);
  writeBaseline(workspace, [], { schemaVersion: 2 });
  write(workspace, 'libs/x/project.json', { name: 'x', targets: {} });
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expected "schemaVersion": 1/);
});

test('exits 2 when a tracked project.json is not valid JSON', (t) => {
  const workspace = scaffold(t, {});
  write(workspace, 'libs/x/project.json', '{ not json');
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /libs\/x\/project\.json/);
});

// A distinct failure from malformed JSON: `git ls-files` still names the
// file, but it is gone from the working tree, so `readFileSync` throws
// ENOENT rather than a JSON parse error.
test('exits 2 when a tracked project.json is unreadable on disk', (t) => {
  const workspace = scaffold(t, {});
  write(workspace, 'libs/x/project.json', { name: 'x', targets: {} });
  commitAll(workspace);
  rmSync(join(workspace, 'libs/x/project.json'));
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /libs\/x\/project\.json/);
});

test('--print lists every baseline entry and every classified target', (t) => {
  const workspace = scaffold(
    t,
    {
      'libs/x/project.json': {
        name: 'x',
        targets: { lint: { executor: '@nx/eslint:lint' } },
      },
    },
    [{ project: 'x', target: 'lint', executor: '@nx/eslint:lint' }],
  );
  const result = run(workspace, '--print');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 baseline entry/);
  assert.match(result.stdout, /baseline: x lint \(@nx\/eslint:lint\)/);
  assert.match(result.stdout, /1 @nx\/\* Declared Target\(s\) classified/);
  assert.match(
    result.stdout,
    /target: x lint \(@nx\/eslint:lint\) \[libs\/x\/project\.json\]/,
  );
});
