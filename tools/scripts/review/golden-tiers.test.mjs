import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sep } from 'node:path';
import test from 'node:test';

import {
  ALL_TIERS,
  CASE_TIERS,
  GOLDEN_SET_PATH,
  REPLAY_INPUT_PATHS,
  caseIdsInTier,
  isFirstWeekOfMonth,
  scheduledTier,
} from './golden-tiers.mjs';

const set = {
  cases: [
    { id: 'a-guard', tier: 'guard' },
    { id: 'b-frontier', tier: 'frontier' },
    { id: 'c-frontier', tier: 'frontier' },
  ],
};

test('a tier selects its own cases, in the set order', () => {
  assert.deepEqual(caseIdsInTier(set, 'guard'), ['a-guard']);
  assert.deepEqual(caseIdsInTier(set, 'frontier'), [
    'b-frontier',
    'c-frontier',
  ]);
});

// The bug this module was extracted for: the replay workflow passed the
// literal "all" and the scorer's own filter rejected it, so the two
// implementations disagreed about the one input the workflow actually sends
// on a brief change. Both spellings mean every case.
test('"all" and no tier both mean every case', () => {
  const every = ['a-guard', 'b-frontier', 'c-frontier'];
  assert.deepEqual(caseIdsInTier(set, ALL_TIERS), every);
  assert.deepEqual(caseIdsInTier(set, undefined), every);
});

test('an unknown tier is refused by name', () => {
  assert.throws(() => caseIdsInTier(set, 'occasional'), /occasional/);
  assert.throws(() => caseIdsInTier(set, 'occasional'), /guard, frontier, all/);
});

// golden.mjs validates the committed set against the same vocabulary this
// module filters by. They were two hand-typed arrays until the reviewer pointed
// out that the change claiming one filter had left two copies of what it
// filters over: a third tier added to one list only would let the filter accept
// a case the validator rejects.
test('the validator and the filter share one tier vocabulary', async () => {
  const { GOLDEN_CASE_TIERS, REVIEW_GOLDEN_SET_PATH } =
    await import('./golden.mjs');
  assert.deepEqual(GOLDEN_CASE_TIERS, CASE_TIERS);
  // Same location, spelled for the platform on one side and for the workflow
  // on the other.
  assert.deepEqual(
    REVIEW_GOLDEN_SET_PATH.split(sep),
    GOLDEN_SET_PATH.split('/'),
  );
});

test('every tier the committed set uses is one this module knows', () => {
  const committed = JSON.parse(readFileSync(GOLDEN_SET_PATH, 'utf8'));
  for (const c of committed.cases)
    assert.ok(CASE_TIERS.includes(c.tier), `${c.id} has tier ${c.tier}`);
});

// The workflow's `cases` job installs no dependencies. If this script ever
// reaches a third-party import, the replay dies at ERR_MODULE_NOT_FOUND
// before a single case runs — which is exactly how it died once.
test('the script runs with no dependencies installed', () => {
  const out = execFileSync(
    process.execPath,
    ['tools/scripts/review/golden-tiers.mjs', '--tier', 'all'],
    { encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } },
  );
  const ids = JSON.parse(out);
  const committed = JSON.parse(readFileSync(GOLDEN_SET_PATH, 'utf8'));
  assert.deepEqual(
    ids,
    committed.cases.map((c) => c.id),
  );
});

test('the CLI and the workflow agree on every tier', () => {
  const run = (args) =>
    JSON.parse(
      execFileSync(process.execPath, args, { encoding: 'utf8' }).trim(),
    );
  for (const tier of [...CASE_TIERS, ALL_TIERS]) {
    assert.deepEqual(
      run(['tools/scripts/review/golden-tiers.mjs', '--tier', tier]),
      run([
        'tools/scripts/review/score-golden-case.mjs',
        '--list',
        '--tier',
        tier,
      ]),
      `the two callers disagree for tier ${tier}`,
    );
  }
});

// ---------------------------------------------------------------------------
// The scheduled cadence (ADR 0109)
// ---------------------------------------------------------------------------

test('a week with no reviewer input change replays nothing', () => {
  assert.equal(
    scheduledTier({
      changedInWeek: false,
      changedInMonth: false,
      firstWeekOfMonth: false,
    }),
    null,
  );
  // The first week of the month is no exception: a guard re-confirms a
  // reviewer that has not moved, which is the spend ADR 0109 removes.
  assert.equal(
    scheduledTier({
      changedInWeek: false,
      changedInMonth: false,
      firstWeekOfMonth: true,
    }),
    null,
  );
});

test('a changed week replays the frontier, and the first week of a changed month replays all', () => {
  assert.equal(
    scheduledTier({
      changedInWeek: true,
      changedInMonth: true,
      firstWeekOfMonth: false,
    }),
    'frontier',
  );
  assert.equal(
    scheduledTier({
      changedInWeek: true,
      changedInMonth: true,
      firstWeekOfMonth: true,
    }),
    ALL_TIERS,
  );
  // A change three weeks ago still earns the monthly guard run, though the
  // week itself was quiet.
  assert.equal(
    scheduledTier({
      changedInWeek: false,
      changedInMonth: true,
      firstWeekOfMonth: true,
    }),
    ALL_TIERS,
  );
});

// The inputs are the ones a replay measures: what produces a review, and the
// harness laid over each case tree (ADR 0102). Dropping one lets a reviewer
// change go a month without a scheduled measurement.
test('the scheduled replay watches every reviewer input', () => {
  for (const path of [
    '.agents/skills/code-review',
    'tools/scripts/review',
    '.github/actions/code-reviewer',
    '.github/workflows/code-review.yml',
    '.github/workflows/review-golden-replay.yml',
    'tools/config/review-golden-set.json',
    'tools/config/review-obligations.json',
    'tools/config/review-rules.json',
    '.claude',
    'tools/scripts/copilot-hooks',
  ])
    assert.ok(REPLAY_INPUT_PATHS.includes(path), `${path} is not watched`);
});

test('the first week of the month is days one to seven', () => {
  assert.equal(isFirstWeekOfMonth(new Date('2026-10-05T03:00:00Z')), true);
  assert.equal(isFirstWeekOfMonth(new Date('2026-10-07T03:00:00Z')), true);
  assert.equal(isFirstWeekOfMonth(new Date('2026-10-08T03:00:00Z')), false);
});
