import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, 'check-typecheck.mjs');
const REPO_ROOT = resolve(HERE, '..', '..');

function writeGraph(t, nodes, dir) {
  const target = dir ?? mkdtempSync(join(tmpdir(), 'typecheck-test-'));
  if (!dir) t.after(() => rmSync(target, { recursive: true, force: true }));
  const file = join(target, 'graph.json');
  writeFileSync(file, JSON.stringify({ graph: { nodes } }));
  return file;
}

function runChecker(graphFile, workspaceRoot) {
  return spawnSync(process.execPath, [CHECKER, graphFile, workspaceRoot], {
    encoding: 'utf8',
  });
}

test('exits 2 when the graph file does not exist', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'typecheck-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = runChecker(join(dir, 'absent.json'), REPO_ROOT);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/);
});

test('exits 2 when no project in the graph has a tsconfig', (t) => {
  // Reporting success here would be the exact defect this script exists for:
  // a green result that means "nothing was looked at".
  const graph = writeGraph(t, {
    ghost: { name: 'ghost', data: { root: 'does/not/exist', targets: {} } },
  });

  const result = runChecker(graph, REPO_ROOT);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /no project tsconfigs/);
});

test('accepts a project whose tsconfig compiles', (t) => {
  // A real project, compiled by the real tsc. `design-tokens` is two source
  // files and one config, so this stays quick while still proving the spawn,
  // the cwd, and the exit-code plumbing all line up.
  const graph = writeGraph(t, {
    'design-tokens': {
      name: 'design-tokens',
      data: { root: 'libs/design-tokens', targets: {} },
    },
  });

  const result = runChecker(graph, REPO_ROOT);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /compile clean/);
});

test('exits 1 and names the config when a project has a type error', (t) => {
  // The fixture lives under the repo root so `npx tsc` resolves TypeScript from
  // the workspace's own node_modules; a temp directory elsewhere would send npx
  // to the registry.
  const dir = mkdtempSync(join(REPO_ROOT, '.tmp-typecheck-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(
    join(dir, 'tsconfig.lib.json'),
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
      include: ['broken.ts'],
    }),
  );
  writeFileSync(join(dir, 'broken.ts'), 'export const n: number = "string";\n');

  const graph = writeGraph(
    t,
    {
      broken: {
        name: 'broken',
        data: { root: dir.slice(REPO_ROOT.length + 1), targets: {} },
      },
    },
    dir,
  );

  const result = runChecker(graph, REPO_ROOT);

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /broken\.ts/);
  assert.match(result.stderr, /error TS/);
  assert.match(result.stderr, /1 error\(s\)/);
});
