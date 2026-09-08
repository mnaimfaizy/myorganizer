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
const set = { schemaVersion: 3, cases: [goldenCase] };

const finding = (over = {}) => ({
  id: 'abcdefabcdef',
  axis: 'standards',
  severity: 'blocking',
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
      'tailwind:classes:check fails on this range, so the brief says suppress',
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
    /both a case and retired/,
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

test('an exact tuple is reported as strict', () => {
  const literal = {
    ...goldenCase,
    expected: [
      {
        ...goldenCase.expected[0],
        source: 'AGENTS.md',
        rule: 'Code fanning out over a domain enum reaches one table',
      },
    ],
  };
  const f = finding();
  f.id = findingId(f);
  const score = scoreCase(literal, { findings: [f] });
  assert.equal(score.matched[0].strict, true);
});

test('the rendered score names misses with their why', () => {
  const md = renderScore(goldenCase, scoreCase(goldenCase, { findings: [] }));
  assert.match(md, /FAIL/);
  assert.match(md, /Recall 0\/1/);
  assert.match(md, /five of six blob types/);
});
