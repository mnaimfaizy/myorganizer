import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GoldenSetError,
  assertGoldenSet,
  loadGoldenSet,
  renderScore,
  scoreCase,
} from './golden.mjs';
import { findingId } from './schema.mjs';

const sha = (c) => c.repeat(40);

const goldenCase = {
  id: 'enum-fanout',
  title: 'A blob type added without its fan-outs',
  incident: 'ADR 0053, #512',
  tier: 'frontier',
  base: sha('a'),
  head: sha('b'),
  expected: [
    {
      id: 'reconcile-omits-member',
      axis: 'standards',
      source: 'AGENTS\\.md|0053',
      rule: 'fan-?out|enum|every member',
      files: ['libs/web-vault/src/lib/vault/vaultMigration.ts'],
      minSeverity: 'should-fix',
      why: 'the reconcile handled five of six blob types',
    },
  ],
  minRecall: 1,
};
const set = { schemaVersion: 4, cases: [goldenCase] };

const finding = (over = {}) => ({
  id: 'abcdefabcdef',
  axis: 'standards',
  severity: 'blocking',
  // A validated finding always carries one, and the strict-tuple annotation
  // hashes it. A fixture without it makes that assertion compare two
  // `undefined`s and pass while the shipped path is broken (issue #724).
  ruleId: 'standard-enum-fanout-not-pinned',
  source: 'AGENTS.md',
  rule: 'Code fanning out over a domain enum reaches one table',
  location: { file: 'libs/web-vault/src/lib/vault/vaultMigration.ts' },
  ...over,
});

test('a well-formed set passes and the committed set loads', () => {
  assert.equal(assertGoldenSet(set), set);
  const committed = loadGoldenSet();
  assert.ok(committed.cases.length >= 3);
  // Every case is attributed: it names the issue it came from and the pull
  // request that introduced it.
  for (const c of committed.cases) {
    assert.match(c.incident, /#\d+/, c.id);
    assert.match(c.incident, /introduced by PR #\d+/, c.id);
  }
  // A guard runs on a narrower trigger than a frontier case (ADR 0072), so
  // the promotion has to cite the runs that earned it rather than assert it.
  for (const c of committed.cases.filter((x) => x.tier === 'guard'))
    assert.match(c.tierEvidence, /promoted \d{4}-\d{2}-\d{2}/, c.id);
  // The frontier is the reason to run the replay at all. A set that is all
  // guard measures nothing, and is far more likely a mistake than a triumph.
  assert.ok(
    committed.cases.some((c) => c.tier === 'frontier'),
    'the set has no frontier case left',
  );
  // The narrowed set is six cases; the never-caught synchronisation case is
  // parked, not retired, and its id stays reserved with a written condition
  // for its return rather than a reason it cannot be won.
  assert.equal(committed.cases.length, 6);
  assert.ok(committed.parked?.length >= 1, 'the set has no parked case');
  for (const p of committed.parked) {
    assert.match(p.incident, /#\d+/, p.id);
    assert.ok(p.reentryCondition, p.id);
  }
});

test('malformed sets are named precisely', () => {
  const bad = (mutate) => {
    const copy = JSON.parse(JSON.stringify(set));
    mutate(copy);
    return () => assertGoldenSet(copy);
  };
  assert.throws(
    bad((s) => (s.schemaVersion = 1)),
    /schemaVersion/,
  );
  assert.throws(
    bad((s) => (s.cases[0].tier = 'occasional')),
    /tier/,
  );
  // A retired case keeps its id reserved, so nothing can quietly re-add it as
  // a live case, and it has to say why it cannot be won.
  const retired = {
    id: 'groceries-ui-written-against-absent-roles',
    title: 'a case a gate already covers',
    incident: 'ADR 0065, issue #632',
    reason:
      'tailwind:classes:check is wired and fails on this range, so ADR 0074 suppresses it',
  };
  assert.equal(
    assertGoldenSet({ ...set, retired: [retired] }).retired.length,
    1,
  );
  assert.throws(
    () => assertGoldenSet({ ...set, retired: [{ ...retired, reason: '' }] }),
    /cannot be won/,
  );
  assert.throws(
    () =>
      assertGoldenSet({ ...set, retired: [{ ...retired, id: goldenCase.id }] }),
    /already a case, retired, or parked/,
  );
  // A parked case keeps its id reserved the same way, but for the opposite
  // reason retirement does: it is hard, not unwinnable, so it carries a
  // reentryCondition rather than a reason it cannot be won.
  const parked = {
    id: 'sync-bookmarks-without-restore-or-meta-push',
    title: 'a case that is hard, not unwinnable',
    incident: 'issues #617 and #589',
    reentryCondition:
      'returns when the deferred checklist candidate becomes a real obligation',
  };
  assert.equal(assertGoldenSet({ ...set, parked: [parked] }).parked.length, 1);
  assert.throws(
    () =>
      assertGoldenSet({
        ...set,
        parked: [{ ...parked, reentryCondition: '' }],
      }),
    /reentryCondition/,
  );
  assert.throws(
    () =>
      assertGoldenSet({ ...set, parked: [{ ...parked, id: goldenCase.id }] }),
    /already a case, retired, or parked/,
  );
  // The collision message is worded generically because a retired id can
  // collide with a parked one, not only with a case (this used to say "is
  // both a case and retired" even when the real conflict was with a parked
  // entry).
  assert.throws(
    () =>
      assertGoldenSet({
        ...set,
        parked: [parked],
        retired: [{ ...retired, id: parked.id }],
      }),
    /already a case, retired, or parked/,
  );
  assert.throws(
    bad((s) => delete s.cases[0].tier),
    /tier/,
  );
  // A guard runs on a narrower trigger, so it has to say what promoted it.
  assert.throws(
    bad((s) => (s.cases[0].tier = 'guard')),
    /promoted it/,
  );
  assert.throws(
    bad((s) => (s.cases[0].head = 'abc')),
    /40-hex/,
  );
  assert.throws(
    bad((s) => (s.cases[0].head = s.cases[0].base)),
    /equals/,
  );
  assert.throws(
    bad((s) => (s.cases[0].expected[0].rule = '(')),
    /bad pattern/,
  );
  assert.throws(
    bad((s) => (s.cases[0].expected[0].files = [])),
    /files/,
  );
  assert.throws(
    bad((s) => (s.cases[0].minRecall = 2)),
    /minRecall/,
  );
  assert.throws(
    bad((s) => delete s.cases[0].expected[0].why),
    /why/,
  );
  assert.throws(
    bad((s) => s.cases.push({ ...s.cases[0] })),
    GoldenSetError,
  );
});

test('a matching finding scores recall 1 and passes', () => {
  const score = scoreCase(goldenCase, { findings: [finding()] });
  assert.equal(score.recall, 1);
  assert.equal(score.pass, true);
  assert.deepEqual(score.missed, []);
  assert.equal(score.matched[0].finding, 'abcdefabcdef');
  assert.equal(score.unexpected, 0);
});

test('axis, source, rule, file, and minimum severity all have to match', () => {
  const miss = (over) =>
    scoreCase(goldenCase, { findings: [finding(over)] }).pass;
  assert.equal(miss({ axis: 'spec' }), false);
  assert.equal(miss({ source: 'docs/ui/GUIDELINES.md' }), false);
  assert.equal(miss({ rule: 'Mysterious Name' }), false);
  assert.equal(miss({ location: { file: 'libs/other.ts' } }), false);
  assert.equal(miss({ location: undefined }), false);
  assert.equal(miss({ severity: 'nit' }), false);
  assert.equal(miss({ severity: 'should-fix' }), true);
});

test('one finding satisfies one expectation, and extras are counted', () => {
  const twice = {
    ...goldenCase,
    expected: [
      goldenCase.expected[0],
      { ...goldenCase.expected[0], id: 'second' },
    ],
  };
  const score = scoreCase(twice, {
    findings: [finding(), finding({ id: '000000000000', rule: 'unrelated' })],
  });
  assert.equal(score.recall, 0.5);
  assert.deepEqual(score.missed, ['second']);
  assert.equal(score.unexpected, 1);
  assert.equal(score.pass, false);
});

test('an expectation that pins a rule id is reported as strict', () => {
  const pinned = {
    ...goldenCase,
    expected: [
      {
        ...goldenCase.expected[0],
        ruleId: 'standard-enum-fanout-not-pinned',
      },
    ],
  };
  const f = finding();
  f.id = findingId(f);
  assert.equal(scoreCase(pinned, { findings: [f] }).matched[0].strict, true);
  // The reviewer named the defect under a different catalogue id: matching
  // still succeeds on the source and rule patterns, but the validator's tuple
  // would not have matched, and the annotation must say so.
  const other = finding({ ruleId: 'standard-missing-focused-test' });
  other.id = findingId(other);
  assert.equal(
    scoreCase(pinned, { findings: [other] }).matched[0].strict,
    false,
  );
  // An expectation that pins nothing is never strict — it is not literal
  // enough to be a tuple, which is the whole claim the annotation makes.
  assert.equal(
    scoreCase(goldenCase, { findings: [f] }).matched[0].strict,
    false,
  );
});

test('a pinned rule id must exist in the rule catalogue', () => {
  const copy = JSON.parse(JSON.stringify(set));
  copy.cases[0].expected[0].ruleId = 'standard-invented-here';
  assert.throws(
    () => assertGoldenSet(copy),
    /ruleId standard-invented-here is not in tools\/config\/review-rules\.json/,
  );
});

test('the rendered score names misses with their why', () => {
  const md = renderScore(goldenCase, scoreCase(goldenCase, { findings: [] }));
  assert.match(md, /FAIL/);
  assert.match(md, /Recall 0\/1/);
  assert.match(md, /five of six blob types/);
});
