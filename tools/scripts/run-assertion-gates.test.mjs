import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER = join(
  dirname(fileURLToPath(import.meta.url)),
  'run-assertion-gates.mjs',
);

test('the aggregate runs every gate against the real repo and exits 0', () => {
  const result = spawnSync(process.execPath, [RUNNER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /✓ readme:check/);
  assert.match(result.stdout, /✓ openapi:artifacts/);
  assert.match(result.stdout, /✓ agents:map:check/);
  assert.match(result.stdout, /✓ vault:pages:check/);
  assert.match(result.stdout, /✓ auth:pages:check/);
  assert.match(result.stdout, /✓ agents:sync:check \(subagents\)/);
  assert.match(result.stdout, /✓ agents:sync:check \(models\)/);
  assert.match(result.stdout, /✓ adr:numbering:check/);
  assert.match(result.stdout, /✓ gates:coverage:check/);
  assert.match(result.stdout, /9\/9 checks passed/);
});

// Guards the aggregate decision itself: replacing it with one `corepack yarn`
// line per checker would cost ~1.3s of overhead per check (ADR 0043). A
// direct `node` run of the aggregate should stay well under that regressed
// shape, which cost roughly ten seconds for seven checks.
test('the aggregate completes in well under the ten-second per-check-line cost', () => {
  const startedAt = performance.now();
  const result = spawnSync(process.execPath, [RUNNER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.ok(
    elapsedMs < 5000,
    `expected the aggregate to run in well under 5000ms, took ${elapsedMs}ms`,
  );
});
