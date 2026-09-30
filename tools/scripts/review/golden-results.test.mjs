import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  GENERATED_END,
  GENERATED_START,
  GoldenResultError,
  OUTCOMES,
  VOID_REASONS,
  appendResultLine,
  buildResultRecord,
  formatResultLine,
  groupRuns,
  parseResultsFile,
  renderRunsTable,
  summarizeRun,
} from './golden-results.mjs';

const CAUGHT = {
  date: '2026-09-30',
  runId: '111',
  commit: 'a'.repeat(40),
  caseId: 'export-envelope-drops-tasks',
  outcome: 'caught',
  recall: 1,
  model: 'claude-sonnet-5',
};

const VOID = {
  date: '2026-09-30',
  runId: '111',
  commit: 'a'.repeat(40),
  caseId: 'release-bump-leaves-generated-client-stale',
  outcome: 'void',
  voidReason: 'rate-limit',
  model: 'claude-sonnet-5',
};

test('buildResultRecord accepts a caught record with fixed key order', () => {
  const record = buildResultRecord(CAUGHT);
  assert.deepEqual(Object.keys(record), [
    'date',
    'run_id',
    'commit',
    'case',
    'outcome',
    'void_reason',
    'recall',
    'total_cost_usd',
    'turns',
    'model',
  ]);
  assert.equal(record.case, 'export-envelope-drops-tasks');
  assert.equal(record.void_reason, null);
  assert.equal(record.recall, 1);
});

test('buildResultRecord accepts a void record with no recall', () => {
  const record = buildResultRecord(VOID);
  assert.equal(record.outcome, 'void');
  assert.equal(record.void_reason, 'rate-limit');
  assert.equal(record.recall, null);
});

test('buildResultRecord rejects a bad date', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, date: '09/30/2026' }),
    GoldenResultError,
  );
});

test('buildResultRecord rejects an outcome outside the vocabulary', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, outcome: 'flaky' }),
    /outcome must be one of/,
  );
});

test('buildResultRecord rejects a void record with no void_reason', () => {
  assert.throws(
    () => buildResultRecord({ ...VOID, voidReason: null }),
    /void_reason must be one of/,
  );
});

test('buildResultRecord rejects a void record outside the reason vocabulary', () => {
  assert.throws(
    () => buildResultRecord({ ...VOID, voidReason: 'gremlins' }),
    /void_reason must be one of/,
  );
});

// This is the acceptance criterion ADR 0101 exists for: a void must never be
// scorable, or it can be read back as a miss or a catch.
test('buildResultRecord rejects a void record carrying a recall', () => {
  assert.throws(
    () => buildResultRecord({ ...VOID, recall: 0 }),
    /carries no recall/,
  );
});

test('buildResultRecord rejects a caught/missed record with a void_reason', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, voidReason: 'rate-limit' }),
    /carries no void_reason/,
  );
});

test('buildResultRecord rejects a non-void record with no recall', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, recall: null }),
    /recall must be a number between 0 and 1/,
  );
});

test('buildResultRecord rejects a recall outside 0..1', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, recall: 1.5 }),
    GoldenResultError,
  );
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, recall: -0.1 }),
    GoldenResultError,
  );
});

test('buildResultRecord rejects a negative total_cost_usd or turns', () => {
  assert.throws(
    () => buildResultRecord({ ...CAUGHT, totalCostUsd: -1 }),
    /total_cost_usd/,
  );
  assert.throws(() => buildResultRecord({ ...CAUGHT, turns: -1 }), /turns/);
});

test('buildResultRecord requires run_id, commit, case, and model', () => {
  for (const field of ['runId', 'commit', 'caseId', 'model']) {
    assert.throws(
      () => buildResultRecord({ ...CAUGHT, [field]: '' }),
      GoldenResultError,
      field,
    );
  }
});

test('OUTCOMES and VOID_REASONS are the documented vocabularies', () => {
  assert.deepEqual(OUTCOMES, ['caught', 'missed', 'void']);
  assert.deepEqual(VOID_REASONS, [
    'rate-limit',
    'turn-ceiling',
    'prevented',
    'answer-sheet-check-failed',
    'unknown',
  ]);
});

test('formatResultLine round-trips through parseResultsFile', () => {
  const record = buildResultRecord(CAUGHT);
  const line = formatResultLine(record);
  assert.doesNotThrow(() => JSON.parse(line));
  const [parsed] = parseResultsFile(`${line}\n`);
  assert.deepEqual(parsed, record);
});

test('parseResultsFile skips blank lines and reads several records', () => {
  const text = `${formatResultLine(buildResultRecord(CAUGHT))}\n\n${formatResultLine(buildResultRecord(VOID))}\n`;
  const records = parseResultsFile(text);
  assert.equal(records.length, 2);
  assert.equal(records[0].outcome, 'caught');
  assert.equal(records[1].outcome, 'void');
});

test('parseResultsFile reports the offending line on malformed JSON', () => {
  const text = `${formatResultLine(buildResultRecord(CAUGHT))}\nnot json\n`;
  assert.throws(() => parseResultsFile(text), /line 2: not valid JSON/);
});

test('parseResultsFile reports the offending line on a schema violation', () => {
  const bad = JSON.stringify({
    ...buildResultRecord(CAUGHT),
    outcome: 'flaky',
  });
  assert.throws(
    () => parseResultsFile(`${bad}\n`),
    /line 1: outcome must be one of/,
  );
});

test('parseResultsFile treats an empty file as zero records', () => {
  assert.deepEqual(parseResultsFile(''), []);
});

test('appendResultLine creates the directory and appends valid lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'golden-results-'));
  const path = join(dir, 'nested', 'results.jsonl');
  appendResultLine(path, CAUGHT);
  appendResultLine(path, VOID);
  const records = parseResultsFile(readFileSync(path, 'utf8'));
  assert.equal(records.length, 2);
  assert.equal(records[0].case, 'export-envelope-drops-tasks');
  assert.equal(records[1].outcome, 'void');
});

test('appendResultLine refuses an invalid record and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'golden-results-'));
  const path = join(dir, 'results.jsonl');
  assert.throws(() => appendResultLine(path, { ...CAUGHT, outcome: 'flaky' }));
});

test('groupRuns groups by run_id in first-seen order', () => {
  const a = buildResultRecord(CAUGHT);
  const b = buildResultRecord({ ...VOID, runId: '111' });
  const c = buildResultRecord({
    ...CAUGHT,
    runId: '222',
    date: '2026-10-01',
    caseId: 'mail-test-setup-assigns-undefined-to-env',
  });
  const groups = groupRuns([a, b, c]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].runId, '111');
  assert.equal(groups[0].records.length, 2);
  assert.equal(groups[1].runId, '222');
  assert.equal(groups[1].records.length, 1);
});

test('groupRuns rejects a run whose records disagree on date, model, or commit', () => {
  const a = buildResultRecord(CAUGHT);
  const b = buildResultRecord({ ...CAUGHT, date: '2026-10-01' });
  assert.throws(() => groupRuns([a, b]), /different date values/);

  const c = buildResultRecord({ ...CAUGHT, model: 'claude-opus-5-5' });
  assert.throws(() => groupRuns([a, c]), /different model values/);
});

test('summarizeRun counts caught, missed, and void separately, never mixed', () => {
  const group = groupRuns([
    buildResultRecord(CAUGHT),
    buildResultRecord({ ...CAUGHT, caseId: 'x', outcome: 'missed', recall: 0 }),
    buildResultRecord(VOID),
  ])[0];
  const s = summarizeRun(group);
  assert.equal(s.caught, 1);
  assert.equal(s.missed, 1);
  assert.equal(s.voided, 1);
  assert.equal(s.scorable, 2);
  assert.equal(s.total, 3);
  assert.equal(s.result, '1 of 2 scorable, 1 void');
});

test('summarizeRun omits the void clause when nothing voided', () => {
  const group = groupRuns([buildResultRecord(CAUGHT)])[0];
  assert.equal(summarizeRun(group).result, '1 of 1');
});

test('renderRunsTable renders a placeholder for an empty record', () => {
  assert.equal(renderRunsTable([]), '_No recorded runs yet._');
});

test('renderRunsTable renders one row per run, and a void never counts as caught or missed', () => {
  const records = [buildResultRecord(CAUGHT), buildResultRecord(VOID)];
  const table = renderRunsTable(records);
  assert.match(
    table,
    /\| Date \| Run ID \| Model \| Cases \| Result \| Commit \|/,
  );
  assert.match(
    table,
    /\| 2026-09-30 \| `111` \| `claude-sonnet-5` \| 2 \| 1 of 1 scorable, 1 void \| `aaaaaaa` \|/,
  );
});

test('GENERATED markers are the ones the checker and the ledger share', () => {
  assert.equal(GENERATED_START, '<!-- GENERATED:golden-runs:START -->');
  assert.equal(GENERATED_END, '<!-- GENERATED:golden-runs:END -->');
});
