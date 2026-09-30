import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const CHECKER = 'tools/scripts/check-review-golden-results.mjs';

const CAUGHT_LINE = JSON.stringify({
  date: '2026-09-30',
  run_id: '111',
  commit: 'a'.repeat(40),
  case: 'export-envelope-drops-tasks',
  outcome: 'caught',
  void_reason: null,
  recall: 1,
  total_cost_usd: 1.47,
  turns: 14,
  model: 'claude-sonnet-5',
});

const VOID_LINE = JSON.stringify({
  date: '2026-09-30',
  run_id: '111',
  commit: 'a'.repeat(40),
  case: 'release-bump-leaves-generated-client-stale',
  outcome: 'void',
  void_reason: 'rate-limit',
  recall: null,
  total_cost_usd: null,
  turns: null,
  model: 'claude-sonnet-5',
});

const LEDGER_TEMPLATE = (generated) => `# Golden replay results

## Runs

| Date | Model | Cases | Result | Reviewer change under test |
| --- | --- | --- | --- | --- |
| 2026-09-07 | \`claude-sonnet-5\` | 3 (pre-tier) | 1 of 3 | none — first measurement |

### Recorded runs

<!-- GENERATED:golden-runs:START -->
${generated}
<!-- GENERATED:golden-runs:END -->
`;

/**
 * The checker reads two fixed paths, so each case runs it in a throwaway
 * tree holding just those two files. `record` is the raw jsonl text;
 * `generated` is what sits between the ledger's markers.
 */
const runOn = ({ record = '', generated = '_No recorded runs yet._' } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'review-golden-results-'));
  mkdirSync(join(dir, 'docs', 'review'), { recursive: true });
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.jsonl'),
    record,
    'utf8',
  );
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.md'),
    LEDGER_TEMPLATE(generated),
    'utf8',
  );
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(process.cwd(), CHECKER)],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
};

test('an empty record matches the placeholder generated section', () => {
  const { code, out } = runOn({});
  assert.equal(code, 0, out);
  assert.match(out, /OK — 0 recorded line/);
});

test('a recorded run matching the generated section passes', () => {
  const generated =
    '| Date | Run ID | Model | Cases | Result | Commit |\n' +
    '| --- | --- | --- | --- | --- | --- |\n' +
    `| 2026-09-30 | \`111\` | \`claude-sonnet-5\` | 2 | 1 of 1 scorable, 1 void | \`${'a'.repeat(7)}\` |`;
  const { code, out } = runOn({
    record: `${CAUGHT_LINE}\n${VOID_LINE}\n`,
    generated,
  });
  assert.equal(code, 0, out);
  assert.match(out, /OK — 2 recorded line/);
});

// This is the drift the whole checker exists to catch: the record moved
// (a case caught became a case missed) and nobody regenerated the ledger.
test('a stale generated section is caught as drift', () => {
  const staleGenerated =
    '| Date | Run ID | Model | Cases | Result | Commit |\n' +
    '| --- | --- | --- | --- | --- | --- |\n' +
    `| 2026-09-30 | \`111\` | \`claude-sonnet-5\` | 1 | 0 of 1 | \`${'a'.repeat(7)}\` |`;
  const { code, out } = runOn({
    record: `${CAUGHT_LINE}\n`,
    generated: staleGenerated,
  });
  assert.equal(code, 1, out);
  assert.match(out, /does not match/);
});

test('a placeholder generated section left in place after a run was recorded is caught', () => {
  const { code, out } = runOn({
    record: `${CAUGHT_LINE}\n`,
    generated: '_No recorded runs yet._',
  });
  assert.equal(code, 1, out);
  assert.match(out, /does not match/);
});

test('an invalid record line fails loudly, naming the line', () => {
  const { code, out } = runOn({ record: 'not json\n' });
  assert.equal(code, 2, out);
  assert.match(out, /line 1: not valid JSON/);
});

// ADR 0101: a void must never be scorable, so a hand-edited void carrying a
// recall has to be rejected rather than silently read as a catch or a miss.
test('a void record carrying a recall is rejected as corrupt', () => {
  const corrupt = JSON.stringify({
    ...JSON.parse(VOID_LINE),
    recall: 1,
  });
  const { code, out } = runOn({ record: `${corrupt}\n` });
  assert.equal(code, 2, out);
  assert.match(out, /carries no recall/);
});

test('missing markers cannot run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-golden-results-'));
  mkdirSync(join(dir, 'docs', 'review'), { recursive: true });
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.jsonl'),
    '',
    'utf8',
  );
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.md'),
    '# Golden replay results\n\nNo markers here.\n',
    'utf8',
  );
  let result;
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(process.cwd(), CHECKER)],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    result = { code: 0, out: stdout };
  } catch (err) {
    result = {
      code: err.status,
      out: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
  assert.equal(result.code, 2, result.out);
  assert.match(result.out, /no .*marker pair/);
});

test('--print renders the expected section without failing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-golden-results-'));
  mkdirSync(join(dir, 'docs', 'review'), { recursive: true });
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.jsonl'),
    `${CAUGHT_LINE}\n`,
    'utf8',
  );
  writeFileSync(
    join(dir, 'docs', 'review', 'golden-replay-results.md'),
    LEDGER_TEMPLATE('anything, --print never reads it'),
    'utf8',
  );
  const stdout = execFileSync(
    process.execPath,
    [join(process.cwd(), CHECKER), '--print'],
    { cwd: dir, encoding: 'utf8' },
  );
  assert.match(
    stdout,
    /\| Date \| Run ID \| Model \| Cases \| Result \| Commit \|/,
  );
});
