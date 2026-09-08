import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ALL_TIERS,
  CASE_TIERS,
  GOLDEN_SET_PATH,
  caseIdsInTier,
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
