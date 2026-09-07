import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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

test('renderer: exit 2 when handed a raw report instead of a normalized one', () => {
  const result = run(RENDER, [FIXTURE]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a normalized report/);
});
