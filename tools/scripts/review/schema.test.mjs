import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPORT_SCHEMA_VERSION,
  computeEffectiveTier,
  computeVerdict,
  findingId,
  formatIssues,
  normalizeReport,
} from './schema.mjs';
import { renderReport } from './render-review-report.mjs';

const HEAD = 'abcdef1234567890abcdef1234567890abcdef12';
const BASE = '1234567890abcdef1234567890abcdef12345678';

const envelope = (overrides = {}) => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  base: BASE,
  head: HEAD,
  tier: 'review:agent',
  spec: { kind: 'issue', ref: '#123', foundBy: 'branch' },
  standardsSources: ['AGENTS.md'],
  executed: [],
  suppressed: { redundant: 0 },
  model: 'claude-fable-5-1',
  durationMs: 1200,
  findings: [],
  ...overrides,
});

const cited = (overrides = {}) => ({
  axis: 'standards',
  severity: 'blocking',
  summary: 'Hand-enumerates VaultBlobType members',
  source: 'AGENTS.md',
  rule: 'Code fanning out over a domain enum reaches one satisfies Record table',
  evidence: {
    kind: 'cited',
    sourceKind: 'standard',
    quote: 'it does not re-enumerate the members in an object literal',
    untrusted: false,
  },
  location: {
    file: 'libs/web-vault/src/sync.ts',
    startLine: 42,
    headSha: HEAD,
  },
  ...overrides,
});

const inferred = (overrides = {}) => ({
  axis: 'standards',
  severity: 'should-fix',
  summary: 'Possible Feature Envy',
  source: 'smell-baseline',
  rule: 'Feature Envy',
  evidence: {
    kind: 'inferred',
    reasoning: 'reaches into three fields of another object',
  },
  ...overrides,
});

const rejects = (raw, fragment) => {
  assert.throws(
    () => normalizeReport(raw),
    (err) => {
      const lines = formatIssues(err).join('\n');
      assert.match(lines, fragment);
      return true;
    },
  );
};

test('a valid report is normalized with ids, verdict, and effective tier', () => {
  const report = normalizeReport(envelope({ findings: [cited(), inferred()] }));
  assert.equal(report.verdict, 'request-changes');
  assert.equal(report.effectiveTier, 'review:agent');
  assert.equal(report.findings.length, 2);
  for (const f of report.findings) assert.match(f.id, /^[0-9a-f]{12}$/);
});

test('blocking on inferred evidence is rejected', () => {
  rejects(
    envelope({ findings: [inferred({ severity: 'blocking' })] }),
    /findings\.0\.severity: blocking requires executed or cited evidence/,
  );
});

test('blocking without a location or a quoted spec line is rejected', () => {
  rejects(
    envelope({ findings: [cited({ location: undefined })] }),
    /findings\.0\.location: blocking requires a diff location or a quoted spec line/,
  );
});

test('a blocking spec omission may anchor to the quoted spec line alone', () => {
  const report = normalizeReport(
    envelope({
      findings: [
        {
          axis: 'spec',
          severity: 'blocking',
          summary: 'Acceptance criterion 3 is not implemented',
          source: '#123',
          rule: 'AC3: export includes the Tasks blob',
          evidence: {
            kind: 'cited',
            sourceKind: 'spec',
            quote: 'AC3: the hardened export includes the Tasks blob',
            untrusted: true,
          },
        },
      ],
    }),
  );
  assert.equal(report.verdict, 'request-changes');
});

test('a quoted spec line must be marked untrusted', () => {
  rejects(
    envelope({
      findings: [
        cited({
          axis: 'spec',
          evidence: {
            kind: 'cited',
            sourceKind: 'spec',
            quote: 'AC3',
            untrusted: false,
          },
        }),
      ],
    }),
    /findings\.0\.evidence\.untrusted: a quoted spec line/,
  );
});

test('a hand-written verdict or finding id is rejected', () => {
  rejects(envelope({ verdict: 'approve' }), /verdict/);
  rejects(
    envelope({ findings: [{ id: 'deadbeef0000', ...cited() }] }),
    /findings\.0: Unrecognized key: "id"/,
  );
});

test('wouldBlock is only allowed on should-fix', () => {
  rejects(
    envelope({ findings: [cited({ wouldBlock: true })] }),
    /findings\.0\.wouldBlock: wouldBlock is only meaningful on a should-fix finding/,
  );
  const ok = normalizeReport(
    envelope({ findings: [inferred({ wouldBlock: true })] }),
  );
  assert.equal(ok.findings[0].wouldBlock, true);
});

test('verdict is a pure function of severities', () => {
  assert.equal(computeVerdict([]), 'approve');
  assert.equal(computeVerdict([{ severity: 'nit' }]), 'approve');
  assert.equal(
    computeVerdict([{ severity: 'nit' }, { severity: 'should-fix' }]),
    'comment',
  );
  assert.equal(
    computeVerdict([{ severity: 'should-fix' }, { severity: 'blocking' }]),
    'request-changes',
  );
});

test('no spec tightens the effective tier to human, interactive stays null', () => {
  const none = { kind: 'none', foundBy: 'none' };
  assert.equal(
    computeEffectiveTier({ tier: 'review:auto', spec: none }),
    'review:human',
  );
  assert.equal(computeEffectiveTier({ tier: null, spec: none }), null);
  assert.equal(
    computeEffectiveTier({
      tier: 'review:auto',
      spec: { kind: 'path', ref: 'x', foundBy: 'argument' },
    }),
    'review:auto',
  );
});

test('a spec of kind none cannot carry a ref', () => {
  rejects(
    envelope({ spec: { kind: 'none', ref: '#1', foundBy: 'branch' } }),
    /spec\.kind: a spec of kind none/,
  );
});

test('two findings with the same identity tuple in one report get distinct, stable ids', () => {
  const at = (startLine) => ({
    axis: 'standards',
    severity: 'should-fix',
    summary: 's',
    source: 'AGENTS.md',
    rule: 'r',
    evidence: {
      kind: 'cited',
      sourceKind: 'standard',
      quote: 'q',
      untrusted: false,
    },
    location: { file: 'libs/a.ts', startLine, headSha: 'a'.repeat(40) },
  });
  const envelope = (findings) => ({
    schemaVersion: 1,
    base: 'b'.repeat(40),
    head: 'a'.repeat(40),
    tier: null,
    spec: { kind: 'none', foundBy: 'none' },
    standardsSources: ['AGENTS.md'],
    executed: [],
    suppressed: { redundant: 0 },
    model: 'm',
    durationMs: 1,
    findings,
  });
  const ids = (findings) =>
    normalizeReport(envelope(findings)).findings.map((f) => f.id);

  const [first, second] = ids([at(10), at(50)]);
  assert.notEqual(first, second);
  assert.equal(first, findingId(at(10)));
  // Numbering follows startLine, not report order, so a reorder is stable.
  assert.deepEqual(ids([at(50), at(10)]), [second, first]);
  // A lone finding keeps the plain tuple id.
  assert.deepEqual(ids([at(50)]), [first]);
});

test('finding identity ignores the line and changes with the file', () => {
  const a = cited();
  const b = cited({ location: { ...a.location, startLine: 99 } });
  const c = cited({ location: { ...a.location, file: 'other.ts' } });
  assert.equal(findingId(a), findingId(b));
  assert.notEqual(findingId(a), findingId(c));
});

test('the renderer keeps the axes apart, folds nits, and diffs by id', () => {
  const current = normalizeReport(
    envelope({
      findings: [
        inferred({
          severity: 'nit',
          summary: 'Rename x',
          rule: 'Mysterious Name',
        }),
        cited(),
        {
          axis: 'spec',
          severity: 'should-fix',
          summary: 'Scope creep: adds a toggle nobody asked for',
          source: '#123',
          rule: 'PRD scope',
          evidence: {
            kind: 'inferred',
            reasoning: 'not in the acceptance criteria',
          },
        },
      ],
    }),
  );
  const previous = normalizeReport(
    envelope({
      head: '9999999999999999999999999999999999999999',
      findings: [cited(), inferred()],
    }),
  );
  const md = renderReport(current, previous, { hunks: false });
  assert.match(md, /^# Code review — Request changes/);
  assert.ok(md.indexOf('## Standards') < md.indexOf('## Spec'));
  assert.match(md, /<summary>1 nit<\/summary>/);
  assert.match(md, /- new: 2/);
  assert.match(md, /- persisting: 1/);
  assert.match(md, /- resolved: 1/);
  assert.match(
    md,
    /Standards: 2 finding\(s\), worst blocking · Spec: 1 finding\(s\), worst should-fix/,
  );
  const standards = md.slice(md.indexOf('## Standards'), md.indexOf('## Spec'));
  assert.ok(standards.indexOf('**blocking**') < standards.indexOf('<details>'));
});

test('a smell-baseline finding cannot block even with cited evidence', () => {
  rejects(
    envelope({
      findings: [cited({ source: 'smell-baseline', rule: 'Feature Envy' })],
    }),
    /findings\.0\.severity: a smell-baseline finding is always a judgement call/,
  );
});

test('the renderer refuses a raw report that skipped the validator', () => {
  assert.throws(
    () => renderReport(envelope({ findings: [cited()] })),
    /verdict|effectiveTier/,
  );
});

test('cost is optional and rendered when present', () => {
  const report = normalizeReport(
    envelope({ cost: { inputTokens: 1200, outputTokens: 300 } }),
  );
  assert.match(
    renderReport(report, null, { hunks: false }),
    /1200 in \/ 300 out tokens/,
  );
});
