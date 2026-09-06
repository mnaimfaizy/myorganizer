import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseArgs } from './cli.mjs';

const VALIDATE = 'tools/scripts/review/validate-review-report.mjs';
const RENDER = 'tools/scripts/review/render-review-report.mjs';
const FIXTURE = 'tools/scripts/review/fixtures/sample-report.json';

const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('parseArgs separates positionals from flags and tolerates a bare flag', () => {
  assert.deepEqual(parseArgs(['in.json', '--out', 'o.json', '--no-hunks']), {
    positional: ['in.json'],
    flags: { out: 'o.json', 'no-hunks': null },
  });
});

test('validator: exit 2 with no input, exit 1 on a rejected report, exit 0 on the fixture', () => {
  assert.equal(run(VALIDATE, []).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'review-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ schemaVersion: 1 }));
  const rejected = run(VALIDATE, [bad]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /report rejected/);
  const out = join(dir, 'normalized.json');
  const ok = run(VALIDATE, [FIXTURE, '--out', out]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /verdict request-changes/);
  const rendered = run(RENDER, [out, '--no-hunks']);
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(rendered.stdout, /^# Code review — Request changes/);
});

test('validator: --tier pins the classifier output over the envelope, and only a real label', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-'));
  const out = join(dir, 'normalized.json');
  const pinned = run(VALIDATE, [
    FIXTURE,
    '--tier',
    'review:agent',
    '--out',
    out,
  ]);
  assert.equal(pinned.status, 0, pinned.stderr);
  const normalized = JSON.parse(readFileSync(out, 'utf8'));
  assert.notEqual(
    JSON.parse(readFileSync(FIXTURE, 'utf8')).tier,
    'review:agent',
    'the fixture must carry a different tier for the override to be observable',
  );
  assert.equal(normalized.tier, 'review:agent');
  assert.equal(normalized.effectiveTier, 'review:agent');

  const bogus = run(VALIDATE, [FIXTURE, '--tier', 'review:bogus']);
  assert.equal(bogus.status, 1);
  assert.match(bogus.stderr, /tier/);
  assert.equal(run(VALIDATE, [FIXTURE, '--tier']).status, 2);
});

test('renderer: exit 2 when handed a raw report instead of a normalized one', () => {
  const result = run(RENDER, [FIXTURE]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a normalized report/);
});
