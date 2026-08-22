#!/usr/bin/env node
// Typechecks every project tsconfig in the workspace.
//
//   node tools/scripts/check-typecheck.mjs [graphFile] [workspaceRoot]
//
// Nothing in CI ran TypeScript before this. `.github/workflows/ci.yml` had no
// `typecheck` target, no `tsc`, and no tsconfig reference, and only 1 of 34
// projects even declared a `typecheck` target. Lint cannot see type errors, and
// most projects transform with babel-jest, which strips types without checking
// them — so a type error could reach `main` and stay there. Two did:
// `libs/mobile/feat/auth` carried a TS2559 pair while `apps/mobile/AGENTS.md`
// documented typecheck as part of mobile's gate, and
// `libs/web/pages/groceries` carried four TS2347 errors in its specs. Both were
// found only by running the compiler by hand.
//
// This is a workspace-level script rather than 30-odd new `project.json`
// targets on purpose. Issue #420 has an open decision about executor-based
// targets versus inferred plugin targets, and hand-declaring a target per
// project would prejudge it. It also matches the nine existing
// `check-*.mjs` scripts.
//
// Spec configs are in scope, not just lib/app. The groceries errors lived only
// in `tsconfig.spec.json`, and `.github/agents/test-reviewer.agent.md` already
// tells sub-agents to run `tsc` over the spec config — the repo treated it as a
// real gate, just an unautomated one.
//
// Generated code must exist before this runs. `apps/backend/src/prisma` is
// gitignored, so a fresh checkout has no `@prisma/client` to compile against and
// backend reports 33 errors that say nothing about the diff. `backend:test`
// declares that dependency via `dependsOn`; CI runs `backend:generate-types`
// before this step for the same reason.
//
// Exit 0 = every config compiles. Exit 1 = type errors. Exit 2 = the check
// could not run.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';

import { GraphUnavailableError, loadProjectGraph } from './lib/nx-graph.mjs';

// Checked in this order; every one that exists is checked, because a project's
// production code and its specs compile under different options.
const CONFIG_NAMES = [
  'tsconfig.lib.json',
  'tsconfig.app.json',
  'tsconfig.spec.json',
];

const fail = (msg) => {
  console.error(`typecheck: ${msg}`);
  process.exit(2);
};

const GRAPH_ARG = process.argv[2];
const WORKSPACE_ROOT = resolve(process.argv[3] ?? process.cwd());

let nodes;
try {
  ({ nodes } = loadProjectGraph(GRAPH_ARG));
} catch (error) {
  if (error instanceof GraphUnavailableError) fail(error.message);
  throw error;
}

const jobs = [];
for (const [name, node] of Object.entries(nodes)) {
  const root = node.data?.root;
  if (!root) continue;
  for (const config of CONFIG_NAMES) {
    const relative = join(root, config);
    if (existsSync(join(WORKSPACE_ROOT, relative))) {
      jobs.push({ name, config, relative });
    }
  }
}

if (jobs.length === 0) fail('no project tsconfigs found');

function runTsc(job) {
  return new Promise((resolveJob) => {
    const child = spawn('npx', ['tsc', '-p', job.relative, '--noEmit'], {
      cwd: WORKSPACE_ROOT,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (status) => {
      const errors = output.match(/error TS\d+/g) ?? [];
      resolveJob({ ...job, status, errors: errors.length, output });
    });
  });
}

// tsc is single-threaded and each config is independent, so run a pool rather
// than 52 sequential compilers. Capped to keep CI runners from thrashing.
const limit = Math.max(2, Math.min(availableParallelism?.() ?? 4, 8));
const queue = [...jobs];
const results = [];

await Promise.all(
  Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      results.push(await runTsc(job));
    }
  }),
);

const failed = results
  .filter((r) => r.status !== 0)
  .sort((a, b) => a.relative.localeCompare(b.relative));

if (failed.length > 0) {
  const total = failed.reduce((n, r) => n + r.errors, 0);
  console.error(
    `typecheck: ${total} error(s) across ${failed.length} of ${results.length} config(s).`,
  );
  for (const r of failed) {
    console.error(`\n  --- ${r.relative} (${r.errors}) ---`);
    for (const line of r.output.split('\n')) {
      if (/error TS\d+/.test(line)) console.error(`  ${line.trim()}`);
    }
  }
  console.error(
    `\ntypecheck: reproduce one with \`npx tsc -p <config> --noEmit\`.`,
  );
  process.exit(1);
}

console.log(
  `typecheck: ${results.length} project config(s) compile clean across ${new Set(results.map((r) => r.name)).size} project(s).`,
);
