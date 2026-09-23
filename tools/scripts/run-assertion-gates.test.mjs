import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { GATE_MANIFEST } from './lib/gate-manifest.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER = join(
  dirname(fileURLToPath(import.meta.url)),
  'run-assertion-gates.mjs',
);

// ADR 0043: each `corepack yarn` line costs ~1.3s of overhead against ~350ms
// of work. Issue #735: a 5000ms wall-clock cap on the whole aggregate is
// platform-sensitive and roster-sensitive, so it went red on Windows while
// the property it was defending stayed healthy.
//
// The bound is per-checker cost divided by a same-run bare-node spawn.
// Adding a checker scales both sides; there is no platform branch.
//
// Threshold placement is pinned by the Agent Brief on issue #735 (Windows 11,
// Node 22.19.0, 2026-09-22) — not the issue body, which only reports
// whole-aggregate wall clock. The brief's spawn and per-checker figures, and
// ADR 0043's yarn-line overhead, live in the constants below. 8 sits between
// those two ratios so the bound fails once cost is more than halfway to a
// yarn-line spawn. The calibration test asserts that placement; this comment
// does not restate the arithmetic.
const AGENT_BRIEF_WINDOWS_BASELINE_MS = 96;
const AGENT_BRIEF_WINDOWS_PER_CHECKER_MS = 372;
const ADR_0043_YARN_LINE_MS = 1300;
const MAX_CHECKER_COST_IN_BASELINES = 8;
const YARN_SHAPE_IN_BASELINES =
  ADR_0043_YARN_LINE_MS / AGENT_BRIEF_WINDOWS_BASELINE_MS;

function measureBareNodeSpawnMs(rounds = 5) {
  let total = 0;
  for (let i = 0; i < rounds; i += 1) {
    const startedAt = performance.now();
    const result = spawnSync(process.execPath, ['-e', '0'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    total += performance.now() - startedAt;
  }
  return total / rounds;
}

function checkerCostInBaselines(elapsedMs, checkerCount, baselineMs) {
  assert.ok(checkerCount > 0, 'checkerCount must be positive');
  assert.ok(baselineMs > 0, 'baseline must be a positive measured spawn');
  return elapsedMs / checkerCount / baselineMs;
}

test('the aggregate runs every gate against the real repo and exits 0', () => {
  const result = spawnSync(process.execPath, [RUNNER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  // Read from the manifest rather than listed here. A hand-copied mirror of the
  // roster is what rotted in design-page-roster.mjs, and a literal count is what
  // made adding the fourteenth checker fail a test about nothing.
  for (const { id } of GATE_MANIFEST) {
    assert.ok(
      result.stdout.includes(`✓ ${id}`),
      `${id} did not report a pass:\n${result.stdout}`,
    );
  }
  const total = GATE_MANIFEST.length;
  assert.match(result.stdout, new RegExp(`${total}/${total} checks passed`));
});

// Guards the aggregate decision itself: replacing it with one `corepack yarn`
// line per checker would cost ~1.3s of overhead per check (ADR 0043). A
// direct `node` run of the aggregate is timed here against a same-run spawn
// so the bound stays meaningful as the roster grows and across platforms.
test('the aggregate stays well under a yarn-line per-checker cost', () => {
  const baselineMs = measureBareNodeSpawnMs();
  const startedAt = performance.now();
  const result = spawnSync(process.execPath, [RUNNER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const checkerCount = GATE_MANIFEST.length;
  const ratio = checkerCostInBaselines(elapsedMs, checkerCount, baselineMs);
  assert.ok(
    ratio < MAX_CHECKER_COST_IN_BASELINES,
    `expected per-checker cost well under the corepack-yarn shape ` +
      `(${YARN_SHAPE_IN_BASELINES.toFixed(1)}× a same-run node spawn, bound ` +
      `${MAX_CHECKER_COST_IN_BASELINES}×); took ${ratio.toFixed(2)}× ` +
      `(${elapsedMs.toFixed(0)}ms across ${checkerCount} checkers, ` +
      `baseline ${baselineMs.toFixed(0)}ms)`,
  );
});

test('a per-checker cost at the yarn-line shape fails the bound', () => {
  const baselineMs = measureBareNodeSpawnMs();
  const holdMs = Math.ceil(baselineMs * YARN_SHAPE_IN_BASELINES);
  const startedAt = performance.now();
  const result = spawnSync(
    process.execPath,
    ['-e', `setTimeout(() => {}, ${holdMs})`],
    { encoding: 'utf8' },
  );
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.status, 0, result.stderr);
  const ratio = checkerCostInBaselines(elapsedMs, 1, baselineMs);
  assert.ok(
    ratio > MAX_CHECKER_COST_IN_BASELINES,
    `expected a ${YARN_SHAPE_IN_BASELINES.toFixed(1)}×-baseline hold to exceed the ` +
      `bound of ${MAX_CHECKER_COST_IN_BASELINES}×; took ${ratio.toFixed(2)}× ` +
      `(${elapsedMs.toFixed(0)}ms vs ${baselineMs.toFixed(0)}ms baseline)`,
  );
});

test('the bound sits between the Agent Brief Windows cost and the yarn shape', () => {
  assert.ok(
    checkerCostInBaselines(
      AGENT_BRIEF_WINDOWS_PER_CHECKER_MS,
      1,
      AGENT_BRIEF_WINDOWS_BASELINE_MS,
    ) < MAX_CHECKER_COST_IN_BASELINES,
  );
  assert.ok(
    checkerCostInBaselines(
      ADR_0043_YARN_LINE_MS,
      1,
      AGENT_BRIEF_WINDOWS_BASELINE_MS,
    ) > MAX_CHECKER_COST_IN_BASELINES,
  );
});
