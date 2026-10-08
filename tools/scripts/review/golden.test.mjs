import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GoldenSetError,
  assertGoldenSet,
  loadGoldenSet,
  renderScore,
  replayObligationCheckFindings,
  replayRepetitionFindings,
  replayRunFactsFindings,
  replayTriggerFindings,
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
    // A clean case (issue #933) names a merged pull request that introduced
    // no defect, so "introduced by PR" does not apply to it the way it does
    // to every other case here.
    if (!c.expectsNoBlocking)
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
  // The set is eight pattern cases plus three clean-diff cases (issue #933):
  // the narrowed six, plus the two frontier cases issue #934 traced from
  // attributed fixes (#745 and the second defect attributed to #77). Three
  // more of that trace are parked, not retired; the fourth was folded into
  // the parked entry already holding its range. The loop below is what
  // asserts the property that matters — every parked entry keeps its id
  // reserved and carries a written condition for its return rather than a
  // reason it cannot be won — so the count above stays out of it.
  assert.equal(committed.cases.length, 11);
  assert.equal(committed.cases.filter((c) => c.expectsNoBlocking).length, 3);
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
  // Promoting the last frontier case satisfies the three-consecutive-catches
  // rule and disables the arm it belongs to: guards run only when the brief or
  // the finding contract moves, so an all-guard set replays nothing on an
  // ordinary review-tooling change. ADR 0072 stated this in its Consequences
  // and said the tests asserted it; none did until this one.
  // The per-case checks run first, so a promotion with no evidence is refused
  // for the missing evidence and never reaches the set-level rule — asserted
  // below, at the guard-must-cite case, not repeated here. What reaches the
  // set-level rule is a *properly cited* promotion of the last frontier case,
  // which is the dangerous one precisely because it looks correct.
  assert.throws(
    bad((s) => {
      s.cases[0].tier = 'guard';
      s.cases[0].tierEvidence = 'promoted on runs 1, 2 and 3';
    }),
    /no frontier case/,
  );
  // A set that keeps one frontier case promotes the other freely.
  const twoCases = JSON.parse(JSON.stringify(set));
  twoCases.cases.push({
    ...JSON.parse(JSON.stringify(goldenCase)),
    id: 'enum-fanout-second',
    tier: 'guard',
    tierEvidence: 'promoted on runs 1, 2 and 3',
  });
  assert.equal(assertGoldenSet(twoCases), twoCases);
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

// ---------------------------------------------------------------------------
// Clean-diff cases (issue #933): a known-good merged pull request, which
// passes only when the report carries no Blocking finding. No expected
// findings, no recall — the opposite shape from every case above.

const cleanGoldenCase = {
  id: 'clean-example',
  title: 'A known-good merged pull request',
  incident:
    'PR #900, clean: merged 2026-09-20; no later fix names it as root cause',
  tier: 'frontier',
  base: sha('c'),
  head: sha('d'),
  expectsNoBlocking: true,
  why: 'a small, focused diff whose own review raised no Blocking finding',
};

test('a well-formed clean case passes and loads', () => {
  const set2 = { schemaVersion: 4, cases: [cleanGoldenCase] };
  assert.equal(assertGoldenSet(set2), set2);
});

test('a malformed clean case is named precisely', () => {
  const set2 = { schemaVersion: 4, cases: [cleanGoldenCase] };
  const bad2 = (mutate) => {
    const copy = JSON.parse(JSON.stringify(set2));
    mutate(copy);
    return () => assertGoldenSet(copy);
  };
  assert.throws(
    bad2((s) => delete s.cases[0].why),
    /must say why this merged pull request was chosen/,
  );
  assert.throws(
    bad2((s) => (s.cases[0].why = '')),
    /must say why this merged pull request was chosen/,
  );
  // A clean case has nothing to recall, so carrying the fields recall is
  // computed from is a contradiction, not a widening.
  assert.throws(
    bad2((s) => {
      s.cases[0].expected = [];
    }),
    /must not carry expected/,
  );
  assert.throws(
    bad2((s) => {
      s.cases[0].minRecall = 1;
    }),
    /must not carry minRecall/,
  );
  // A pattern case (the default shape) must not carry `why` — that field
  // belongs to a clean case, and each pattern expectation has its own.
  const bad = (mutate) => {
    const copy = JSON.parse(JSON.stringify(set));
    mutate(copy);
    return () => assertGoldenSet(copy);
  };
  assert.throws(
    bad((s) => {
      s.cases[0].why = 'stray';
    }),
    /why belongs to a clean case/,
  );
});

test('a clean case scores clean-pass with no Blocking finding, never a recall number', () => {
  const score = scoreCase(cleanGoldenCase, { findings: [] });
  assert.equal(score.outcome, 'clean-pass');
  assert.equal(score.pass, true);
  assert.equal(score.clean, true);
  assert.deepEqual(score.blocking, []);
  assert.equal('recall' in score, false);
  assert.equal('minRecall' in score, false);
});

test('a should-fix or nit finding does not fail a clean case', () => {
  for (const severity of ['should-fix', 'nit']) {
    const score = scoreCase(cleanGoldenCase, {
      findings: [finding({ severity })],
    });
    assert.equal(score.outcome, 'clean-pass', severity);
    assert.equal(score.pass, true, severity);
  }
});

test('a clean case scores clean-fail on one Blocking finding, and names it', () => {
  const score = scoreCase(cleanGoldenCase, {
    findings: [finding({ severity: 'blocking' })],
  });
  assert.equal(score.outcome, 'clean-fail');
  assert.equal(score.pass, false);
  assert.deepEqual(score.blocking, ['abcdefabcdef']);
  assert.equal('recall' in score, false);
});

test('the rendered clean score reports clean-pass or clean-fail, never a recall count', () => {
  const pass = renderScore(
    cleanGoldenCase,
    scoreCase(cleanGoldenCase, { findings: [] }),
  );
  assert.match(pass, /clean-pass/);
  assert.doesNotMatch(pass, /Recall/);

  const fail = renderScore(
    cleanGoldenCase,
    scoreCase(cleanGoldenCase, {
      findings: [finding({ severity: 'blocking' })],
    }),
  );
  assert.match(fail, /clean-fail/);
  assert.match(fail, /abcdefabcdef/);
  assert.doesNotMatch(fail, /Recall/);
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

test('a pinned rule id matches on its own, so reworded prose is not a miss', () => {
  const pinned = {
    ...goldenCase,
    expected: [
      { ...goldenCase.expected[0], ruleId: 'standard-enum-fanout-not-pinned' },
    ],
  };
  // The reviewer picked exactly the pinned id but phrased `source` and `rule`
  // nothing like the patterns. Rewording is what took `rule` out of the
  // identity tuple in issue #718; letting it decide recall here would put the
  // free-form text back in charge of a measurement (issue #724).
  const reworded = finding({
    source:
      'docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md',
    rule: 'reach the pinned table instead of listing the members again',
  });
  assert.equal(scoreCase(pinned, { findings: [reworded] }).pass, true);

  // The widening is not a free pass: a finding that neither pins the id nor
  // matches the prose is still a miss.
  const unrelated = finding({
    ruleId: 'standard-missing-focused-test',
    source: 'docs/ui/GUIDELINES.md',
    rule: 'Mysterious Name',
  });
  assert.equal(scoreCase(pinned, { findings: [unrelated] }).pass, false);

  // An expectation that pins nothing is unchanged: the prose still decides.
  assert.equal(scoreCase(goldenCase, { findings: [reworded] }).pass, false);
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

// ---------------------------------------------------------------------------
// ADR 0101: the replay checks the answer sheet before it scores. Each case
// below is one way a failed sheet comes back as a miss.

const replaySteps = ({
  check = [
    '        run: |',
    '          corepack yarn review:obligations:check w.json a.json \\',
    '            --report tmp/code-review/report.json',
  ],
  score = ['        run: corepack yarn review:golden:score --case x'],
  checkFirst = true,
} = {}) => {
  const checkStep = ['      - name: Check the obligation answers', ...check];
  const scoreStep = ['      - name: Score the case', ...score];
  return [
    'jobs:',
    '  replay:',
    '    steps:',
    '      - name: Require a validated report',
    '        run: exit 0',
    ...(checkFirst
      ? [...checkStep, ...scoreStep]
      : [...scoreStep, ...checkStep]),
    '      - name: Keep the report',
    '        if: always()',
    '        run: exit 0',
  ].join('\n');
};

test('the real replay workflow checks the answer sheet before it scores', () => {
  const workflow = readFileSync(
    '.github/workflows/review-golden-replay.yml',
    'utf8',
  );
  assert.deepEqual(replayObligationCheckFindings(workflow), []);
});

test('a replay that checks, with the report, before scoring is sound', () => {
  // The `if: always()` on the step after the score is not the score's: a
  // step's block ends at the next `- name:` line.
  assert.deepEqual(replayObligationCheckFindings(replaySteps()), []);
});

test('a replay that runs both scripts by file, from extracted tooling, is sound', () => {
  // ADR 0102: the case head's package.json has no review:* scripts, so the
  // replay runs the files the scripts name. Matching only the package script
  // would report this sound workflow as one that never checks.
  assert.deepEqual(
    replayObligationCheckFindings(
      replaySteps({
        check: [
          '        run: |',
          '          node tools/scripts/check-review-obligation-answers.mjs w a \\',
          '            --report "$CR/report.json"',
        ],
        score: [
          '        run: node tools/scripts/review/score-golden-case.mjs --case x',
        ],
      }),
    ),
    [],
  );
});

test('a check run through run-from-tooling is a run', () => {
  assert.deepEqual(
    replayObligationCheckFindings(
      replaySteps({
        check: [
          '        run: |',
          '          node "$TOOLING/tools/scripts/review/run-from-tooling.mjs" check-review-obligation-answers.mjs \\',
          '            w a --report "$CR/report.json"',
        ],
      }),
    ),
    [],
  );
});

test('naming the scripts without running them is not running them', () => {
  // The tooling-extraction step names the checker in `git archive`, and
  // loading a case runs the scorer with --show; neither checks nor scores.
  const [f] = replayObligationCheckFindings(
    replaySteps({
      check: [
        '        run: git archive HEAD tools/scripts/check-review-obligation-answers.mjs',
      ],
      score: [
        '        run: node tools/scripts/review/score-golden-case.mjs --show x',
      ],
    }),
  );
  assert.match(f, /no step runs review:obligations:check/);
});

test('a replay that never runs the check is the run 35833576958 shape', () => {
  const [f] = replayObligationCheckFindings(
    replaySteps({ check: ['        run: echo nothing'] }),
  );
  assert.match(f, /no step runs review:obligations:check/);
});

test('a check after the score scores the void first', () => {
  assert.match(
    replayObligationCheckFindings(replaySteps({ checkFirst: false })).join(),
    /runs after "Score the case"/,
  );
});

test('a check without --report trusts the sheet about its own findings', () => {
  assert.match(
    replayObligationCheckFindings(
      replaySteps({
        check: ['        run: corepack yarn review:obligations:check w a'],
      }),
    ).join(),
    /does not pass --report/,
  );
});

test('a check that continues on error does not stop the score', () => {
  assert.match(
    replayObligationCheckFindings(
      replaySteps({
        check: [
          '        continue-on-error: true',
          '        run: corepack yarn review:obligations:check w a --report r',
        ],
      }),
    ).join(),
    /continues on error/,
  );
});

test('a score with an if: can run after a failed sheet', () => {
  assert.match(
    replayObligationCheckFindings(
      replaySteps({
        score: [
          '        if: always()',
          '        run: corepack yarn review:golden:score --case x',
        ],
      }),
    ).join(),
    /carries an if:/,
  );
});

// ---------------------------------------------------------------------------
// The replay's triggers (ADR 0109)
// ---------------------------------------------------------------------------

const triggers = ({
  on = `on:
  pull_request:
    types: [labeled]
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:
    inputs:
      tier:
        type: choice
`,
  concurrency = `concurrency:
  group: golden-replay-\${{ github.event.pull_request.number || github.ref }}\${{ github.event.action == 'labeled' && github.event.label.name != 'golden-replay' && format('-inert-{0}', github.run_id) || '' }}
  cancel-in-progress: true
`,
  body = `jobs:
  cases:
    if: github.event_name != 'pull_request' || github.event.label.name == 'golden-replay'
    steps:
      - run: node tools/scripts/review/golden-tiers.mjs --scheduled
`,
} = {}) =>
  `name: Golden Replay\n\n${on}\npermissions:\n  contents: read\n\n${concurrency}\n${body}`;

test('the replay workflow in the tree runs on a schedule and on request only', () => {
  const workflow = readFileSync(
    '.github/workflows/review-golden-replay.yml',
    'utf8',
  );
  assert.deepEqual(replayTriggerFindings(workflow), []);
});

test('a replay on request, on a schedule, and by dispatch is sound', () => {
  assert.deepEqual(replayTriggerFindings(triggers()), []);
});

// The trigger ADR 0109 removes: a path filter matched against the whole Pull
// Request diff, which bought 88% of three weeks' replay spend.
test('a replay that fires on pushes to a Pull Request is refused', () => {
  const findings = replayTriggerFindings(
    triggers({
      on: `on:
  pull_request:
    paths:
      - '.agents/skills/code-review/**'
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:
`,
    }),
  );
  assert.ok(
    findings.some((f) => /labeled/.test(f)),
    findings.join('\n'),
  );
  assert.ok(
    findings.some((f) => /paths/.test(f)),
    findings.join('\n'),
  );
});

// YAML keeps a comment in whatever block it sits in, so a comment line
// between two keys of pull_request must not end the block before the second.
test('a path filter behind a comment line is still seen', () => {
  const findings = replayTriggerFindings(
    triggers({
      on: `on:
  pull_request:
    types: [labeled]
  # a note at the trigger's own depth
    paths:
      - '.claude/**'
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:
`,
    }),
  );
  assert.ok(
    findings.some((f) => /paths filter/.test(f)),
    findings.join('\n'),
  );
});

test('a replay with no schedule or no dispatch is refused', () => {
  const noSchedule = replayTriggerFindings(
    triggers({
      on: 'on:\n  pull_request:\n    types: [labeled]\n  workflow_dispatch:\n',
    }),
  );
  assert.ok(
    noSchedule.some((f) => /schedule/.test(f)),
    noSchedule.join('\n'),
  );
  const noDispatch = replayTriggerFindings(
    triggers({
      on: "on:\n  pull_request:\n    types: [labeled]\n  schedule:\n    - cron: '0 3 * * 1'\n",
    }),
  );
  assert.ok(
    noDispatch.some((f) => /workflow_dispatch/.test(f)),
    noDispatch.join('\n'),
  );
});

// Any other label reaches the workflow too. Without the job guard it replays;
// without the inert concurrency group it cancels a replay already running —
// the failure that cost three Code Review runs (AGENTS.md, review:concurrency).
test('a replay that answers every label, or lets one cancel it, is refused', () => {
  const unguarded = replayTriggerFindings(
    triggers({
      body: 'jobs:\n  cases:\n    steps:\n      - run: node tools/scripts/review/golden-tiers.mjs --scheduled\n',
    }),
  );
  assert.ok(
    unguarded.some((f) => /other label/.test(f)),
    unguarded.join('\n'),
  );
  const cancels = replayTriggerFindings(
    triggers({
      concurrency:
        'concurrency:\n  group: golden-replay-${{ github.ref }}\n  cancel-in-progress: true\n',
    }),
  );
  assert.ok(
    cancels.some((f) => /concurrency/.test(f)),
    cancels.join('\n'),
  );
});

test('a schedule that does not ask which inputs moved is refused', () => {
  const findings = replayTriggerFindings(
    triggers({
      body: "jobs:\n  cases:\n    if: github.event_name != 'pull_request' || github.event.label.name == 'golden-replay'\n",
    }),
  );
  assert.ok(
    findings.some((f) => /--scheduled/.test(f)),
    findings.join('\n'),
  );
});

// ---------------------------------------------------------------------------
// The scheduled repetitions (ADR 0116)
// ---------------------------------------------------------------------------

const repetitionSet = {
  cases: [
    { id: 'a-guard', tier: 'guard' },
    { id: 'b-frontier', tier: 'frontier' },
  ],
};

const repeating = ({
  list = [
    '          EVENT: ${{ github.event_name }}',
    '        run: |',
    '          MATRIX="$(node tools/scripts/review/golden-tiers.mjs --matrix --tier "$TIERS" --event "$EVENT")"',
  ],
  matrix = '        include: ${{ fromJSON(needs.cases.outputs.matrix) }}',
  transcript = '          transcript-artifact: golden-transcript-${{ matrix.case }}-r${{ matrix.repetition }}',
  artifact = '          name: golden-${{ matrix.case }}-r${{ matrix.repetition }}',
} = {}) =>
  [
    'jobs:',
    '  cases:',
    '    steps:',
    '      - name: List the cases',
    '        env:',
    ...list,
    '  replay:',
    '    strategy:',
    '      matrix:',
    matrix,
    '    steps:',
    '      - name: Run the reviewer',
    '        with:',
    transcript,
    '      - name: Keep the report',
    '        with:',
    artifact,
    '',
  ].join('\n');

test('the replay workflow in the tree repeats a frontier case three times on the schedule', () => {
  const workflow = readFileSync(
    '.github/workflows/review-golden-replay.yml',
    'utf8',
  );
  assert.deepEqual(replayRepetitionFindings(workflow, loadGoldenSet()), []);
});

test('a workflow that asks for the repetition matrix and keeps each result apart is sound', () => {
  assert.deepEqual(replayRepetitionFindings(repeating(), repetitionSet), []);
});

// The matrix this replaced: a bare list of case ids, one session each. The
// schedule then buys one run per case, and one run decides nothing.
test('a matrix of case ids alone is refused', () => {
  const findings = replayRepetitionFindings(
    repeating({
      list: [
        '        run: |',
        '          MATRIX="$(node tools/scripts/review/golden-tiers.mjs --tier "$TIERS")"',
      ],
      matrix: '        case: ${{ fromJSON(needs.cases.outputs.matrix) }}',
    }),
    repetitionSet,
  );
  assert.ok(
    findings.some((f) => /--matrix --event/.test(f)),
    findings.join('\n'),
  );
  assert.ok(
    findings.some((f) => /never becomes a reviewer session/.test(f)),
    findings.join('\n'),
  );
});

test('a matrix built without the event is refused', () => {
  const findings = replayRepetitionFindings(
    repeating({
      list: [
        '        run: |',
        '          MATRIX="$(node tools/scripts/review/golden-tiers.mjs --matrix --tier "$TIERS")"',
      ],
    }),
    repetitionSet,
  );
  assert.ok(
    findings.some((f) => /--matrix --event/.test(f)),
    findings.join('\n'),
  );
});

// upload-artifact refuses a name already taken in the run, so three
// repetitions under one name keep one result line and lose two.
test('an artifact not named for its repetition is refused', () => {
  const findings = replayRepetitionFindings(
    repeating({
      artifact: '          name: golden-${{ matrix.case }}',
      transcript:
        '          transcript-artifact: golden-transcript-${{ matrix.case }}',
    }),
    repetitionSet,
  );
  assert.ok(
    findings.some((f) => /result artifact is not named/.test(f)),
    findings.join('\n'),
  );
  assert.ok(
    findings.some((f) => /transcript artifact is not named/.test(f)),
    findings.join('\n'),
  );
});

// --- the replay voids a review that did not run as built (ADR 0123 item 7) ---

const runFactsSteps = ({
  check = [
    '      - name: Check the run against its transcript',
    '        run: |',
    '          REASON="$(jq -r \'.runFacts.failures // [] | .[0].reason // empty\' n.json)"',
  ],
  score = [
    '      - name: Score the case',
    '        run: node tools/scripts/review/score-golden-case.mjs --case x',
  ],
  record = [
    '      - name: Record the result',
    '        if: always()',
    '        run: |',
    '          ARGS+=(--normalized n.json)',
    '          node tools/scripts/review/record-golden-result.mjs "${ARGS[@]}"',
  ],
  order = ['check', 'score', 'record'],
} = {}) => {
  const blocks = { check, score, record };
  return ['    steps:', ...order.flatMap((name) => blocks[name])].join('\n');
};

test('the replay workflow in the tree voids a review that did not run as built', () => {
  const workflow = readFileSync(
    '.github/workflows/review-golden-replay.yml',
    'utf8',
  );
  assert.deepEqual(replayRunFactsFindings(workflow), []);
});

test('a replay that reads the run failures before scoring and records the report is sound', () => {
  assert.deepEqual(replayRunFactsFindings(runFactsSteps()), []);
});

test('a replay that never reads the run failures scores a run production would fail', () => {
  const [finding] = replayRunFactsFindings(runFactsSteps({ check: [] }));
  assert.match(finding, /no step reads \.runFacts\.failures/);
});

test('reading the run failures after the score, or continuing past them, is a finding', () => {
  assert.match(
    replayRunFactsFindings(
      runFactsSteps({ order: ['score', 'check', 'record'] }),
    )[0],
    /runs after "Score the case"/,
  );
  assert.match(
    replayRunFactsFindings(
      runFactsSteps({
        check: [
          '      - name: Check the run against its transcript',
          '        continue-on-error: true',
          "        run: jq '.runFacts.failures' n.json",
        ],
      }),
    )[0],
    /continues on error/,
  );
});

test('a recorder that is not handed the normalized report is a finding', () => {
  assert.match(
    replayRunFactsFindings(
      runFactsSteps({
        record: [
          '      - name: Record the result',
          '        run: node tools/scripts/review/record-golden-result.mjs "${ARGS[@]}"',
        ],
      }),
    )[0],
    /does not pass --normalized/,
  );
});
