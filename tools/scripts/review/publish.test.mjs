import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STICKY_MARKER,
  findingMarker,
  inlineComments,
  planPublication,
  planRelabel,
  targetTierLabel,
} from './publish.mjs';

const finding = (over = {}) => ({
  id: 'abc123def456',
  axis: 'standards',
  severity: 'blocking',
  summary: 'a thing',
  source: 'AGENTS.md',
  rule: 'the rule',
  evidence: {
    kind: 'cited',
    sourceKind: 'standard',
    quote: 'q',
    untrusted: false,
  },
  location: {
    file: 'libs/a.ts',
    startLine: 3,
    endLine: 5,
    headSha: 'a'.repeat(40),
  },
  ...over,
});

const normalized = (
  findings,
  verdict = 'request-changes',
  effectiveTier = 'review:agent',
) => ({
  verdict,
  effectiveTier,
  findings,
});

const ctx = {
  tier: 'review:agent',
  headSha: 'a'.repeat(40),
  runUrl: 'https://example.test/run/1',
  currentLabels: ['tooling', 'review:agent'],
};

test('a blocking verdict targets human; otherwise the effective tier; no tier stays null', () => {
  assert.equal(
    targetTierLabel({
      tier: 'review:auto',
      effectiveTier: 'review:auto',
      verdict: 'request-changes',
    }),
    'review:human',
  );
  assert.equal(
    targetTierLabel({
      tier: 'review:agent',
      effectiveTier: 'review:human',
      verdict: 'comment',
    }),
    'review:human',
  );
  assert.equal(
    targetTierLabel({
      tier: 'review:agent',
      effectiveTier: 'review:agent',
      verdict: 'approve',
    }),
    'review:agent',
  );
  assert.equal(
    targetTierLabel({ tier: null, effectiveTier: null, verdict: 'approve' }),
    null,
  );
  assert.throws(() => targetTierLabel({ verdict: 'lgtm' }), /unknown verdict/);
});

test('relabel adds the target and removes the other review labels, or does nothing', () => {
  assert.deepEqual(planRelabel(['tooling', 'review:agent'], 'review:human'), {
    add: ['review:human'],
    remove: ['review:agent'],
  });
  assert.equal(planRelabel(['tooling', 'review:human'], 'review:human'), null);
  assert.equal(planRelabel(['tooling'], null), null);
  assert.deepEqual(planRelabel([], 'review:auto'), {
    add: ['review:auto'],
    remove: [],
  });
  assert.throws(() => planRelabel([], 'review:ship'), /unknown tier label/);
});

test('inline comments: blocking with a location only, once per id', () => {
  const out = inlineComments({
    findings: [
      finding(),
      finding({ id: 'ffffffffffff', severity: 'should-fix' }),
      finding({ id: 'eeeeeeeeeeee', location: undefined }),
      finding({
        id: 'dddddddddddd',
        location: { file: 'x.ts', startLine: 9, headSha: 'a'.repeat(40) },
      }),
    ],
    existingBodies: [`hello ${findingMarker('dddddddddddd')} world`],
  });
  assert.deepEqual(
    out.map((c) => [c.id, c.path, c.line, c.startLine]),
    [['abc123def456', 'libs/a.ts', 5, 3]],
  );
  assert.ok(out[0].body.startsWith(findingMarker('abc123def456')));
  assert.match(out[0].body, /\*\*Blocking · Standards\*\*/);
  assert.match(out[0].body, /Evidence: cited standard: q/);
});

test('a published plan carries the sticky marker, the inline set, the relabel, and the check outcome', () => {
  const plan = planPublication({
    ...ctx,
    normalized: normalized([finding()]),
    rendered: '# Code review — request changes\n\nbody\n',
  });
  assert.equal(plan.outcome, 'published');
  assert.ok(plan.summary.startsWith(STICKY_MARKER));
  assert.match(plan.summary, /aaaaaaa/);
  assert.match(plan.summary, /# Code review — request changes/);
  assert.equal(plan.inline.length, 1);
  assert.deepEqual(plan.relabel, {
    add: ['review:human'],
    remove: ['review:agent'],
  });
  assert.equal(plan.failCheck, true);
});

test('an approve verdict on an agent tier leaves the label alone and passes the check', () => {
  const plan = planPublication({
    ...ctx,
    normalized: normalized([finding({ severity: 'nit' })], 'approve'),
    rendered: 'ok',
  });
  assert.equal(plan.relabel, null);
  assert.equal(plan.inline.length, 0);
  assert.equal(plan.failCheck, false);
});

test('no spec tightens the label to human even with no blocking finding', () => {
  const plan = planPublication({
    ...ctx,
    normalized: normalized([], 'approve', 'review:human'),
    rendered: 'ok',
  });
  assert.deepEqual(plan.relabel, {
    add: ['review:human'],
    remove: ['review:agent'],
  });
  assert.equal(plan.failCheck, false);
});

test('a rejected report posts the reason, relabels to human, and fails the check', () => {
  const plan = planPublication({
    ...ctx,
    rejectedReason: 'findings.0: blocking needs evidence\n',
  });
  assert.equal(plan.outcome, 'rejected');
  assert.equal(plan.verdict, null);
  assert.match(plan.summary, /no verdict/);
  assert.match(plan.summary, /blocking needs evidence/);
  assert.deepEqual(plan.relabel, {
    add: ['review:human'],
    remove: ['review:agent'],
  });
  assert.equal(plan.failCheck, true);
});

test('a rejected report on an interactive run (no tier) does not relabel', () => {
  const plan = planPublication({
    ...ctx,
    tier: null,
    currentLabels: [],
    rejectedReason: 'x',
  });
  assert.equal(plan.relabel, null);
});
