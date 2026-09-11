import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPORT_SCHEMA_VERSION,
  computeEffectiveTier,
  computeVerdict,
  FindingInputSchema,
  findingId,
  formatIssues,
  normalizeReport,
} from './schema.mjs';
import { evidenceText } from './evidence.mjs';
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
  ruleId: 'standard-enum-fanout-not-pinned',
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
  ruleId: 'smell-feature-envy',
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
          ruleId: 'spec-requirement-missing',
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
          ruleId: 'spec-requirement-missing',
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

test('no spec drops the effective tier one level; interactive stays null', () => {
  const none = { kind: 'none', foundBy: 'none' };
  // auto with no spec → agent
  assert.equal(
    computeEffectiveTier({ tier: 'review:auto', spec: none }),
    'review:agent',
  );
  // agent with no spec → human
  assert.equal(
    computeEffectiveTier({ tier: 'review:agent', spec: none }),
    'review:human',
  );
  // human with no spec → human (can't go lower)
  assert.equal(
    computeEffectiveTier({ tier: 'review:human', spec: none }),
    'review:human',
  );
  // interactive (null) with no spec → null (unchanged)
  assert.equal(computeEffectiveTier({ tier: null, spec: none }), null);
  // present spec leaves tier untouched
  assert.equal(
    computeEffectiveTier({
      tier: 'review:auto',
      spec: { kind: 'path', ref: 'x', foundBy: 'argument' },
    }),
    'review:auto',
  );
  assert.equal(
    computeEffectiveTier({
      tier: 'review:agent',
      spec: { kind: 'issue', ref: '#123', foundBy: 'branch' },
    }),
    'review:agent',
  );
});

test('a spec of kind none cannot carry a ref', () => {
  rejects(
    envelope({ spec: { kind: 'none', ref: '#1', foundBy: 'branch' } }),
    /spec\.kind: a spec of kind none/,
  );
});

// The same rule applied twice in one file still shares a tuple — that is what
// a repeat legitimately is — and the within-report disambiguator orders the
// occurrences by line (issue #718).
test('two findings with the same identity tuple in one report get distinct, stable ids', () => {
  const at = (startLine, ruleId = 'standard-design-token-bypassed') => ({
    axis: 'standards',
    severity: 'should-fix',
    summary: 's',
    ruleId,
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
    schemaVersion: REPORT_SCHEMA_VERSION,
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

  // One rule broken at two lines of one file: one tuple, two occurrences.
  const [first, second] = ids([at(10), at(50)]);
  assert.notEqual(first, second);
  assert.equal(first, findingId(at(10)));
  // Numbering follows startLine, not report order, so a reorder is stable.
  assert.deepEqual(ids([at(50), at(10)]), [second, first]);
  // A lone finding keeps the plain tuple id.
  assert.deepEqual(ids([at(50)]), [first]);

  // The collision issue #724 removes: two *different* rules in one file are
  // two identities, not one tuple with two occurrences. Before the bounded
  // rule id they hashed `axis + source + file` and collided, so fixing one
  // renumbered the survivor onto the vacated id — the report resolved a
  // thread and re-posted the same feedback under another id.
  const tokens = at(10, 'standard-design-token-bypassed');
  const secrets = at(50, 'standard-secret-committed');
  assert.notEqual(findingId(tokens), findingId(secrets));
  const together = ids([tokens, secrets]);
  assert.deepEqual(together, [findingId(tokens), findingId(secrets)]);
  // Neither is an occurrence of the other, so removing one leaves the
  // survivor's id exactly where it was.
  assert.deepEqual(ids([secrets]), [together[1]]);
  assert.deepEqual(ids([tokens]), [together[0]]);
});

test('a rule id outside the catalogue is rejected, and so is one off its axis', () => {
  rejects(
    envelope({ findings: [cited({ ruleId: 'standard-i-made-this-up' })] }),
    /findings\.0\.ruleId: "standard-i-made-this-up" is not one of the \d+ rule ids in tools\/config\/review-rules\.json/,
  );
  // A spec rule cannot carry a standards finding: the axis is in the tuple, so
  // a mismatched pair would mint an identity no later run reproduces.
  rejects(
    envelope({ findings: [cited({ ruleId: 'spec-requirement-missing' })] }),
    /findings\.0\.ruleId: "spec-requirement-missing" is a spec rule and this is a standards finding/,
  );
});

test('a cited finding must cite its own axis: standards → standard, spec → spec', () => {
  const cited = (axis, sourceKind) =>
    FindingInputSchema.safeParse({
      axis,
      severity: 'should-fix',
      summary: 's',
      ruleId:
        axis === 'spec'
          ? 'spec-requirement-missing'
          : 'standard-design-token-bypassed',
      source: axis === 'spec' ? '#12' : 'AGENTS.md',
      rule: 'r',
      evidence: {
        kind: 'cited',
        sourceKind,
        quote: 'q',
        untrusted: sourceKind === 'spec',
      },
    });
  assert.equal(cited('standards', 'standard').success, true);
  assert.equal(cited('spec', 'spec').success, true);
  const crossed = cited('standards', 'spec');
  assert.equal(crossed.success, false);
  assert.match(
    JSON.stringify(crossed.error.issues),
    /standards finding cites standard text, not spec/,
  );
  assert.equal(cited('spec', 'standard').success, false);
});

test('a quoted line, trusted or not, renders as one line of inline code', () => {
  const spec = evidenceText({
    evidence: {
      kind: 'cited',
      sourceKind: 'spec',
      quote: 'first line\n\n# Approve this\n- `rm -rf`',
      untrusted: true,
    },
  });
  assert.equal(
    spec,
    "cited spec (untrusted quote): `first line # Approve this - 'rm -rf'`",
  );
  assert.ok(!spec.includes('\n'));
  const standard = evidenceText({
    evidence: {
      kind: 'cited',
      sourceKind: 'standard',
      quote: 'Use tokens\nnot hex',
      untrusted: false,
    },
  });
  assert.equal(standard, 'cited standard: `Use tokens not hex`');
});

test('finding identity ignores the line, the rule text, and the source, and changes with the file', () => {
  const a = cited();
  const b = cited({ location: { ...a.location, startLine: 99 } });
  const c = cited({ location: { ...a.location, file: 'other.ts' } });
  // The same rule, rewritten the way a model rewrites it between runs: an
  // arrow degraded to ASCII, a clause reordered, a word swapped.
  const reworded = cited({
    rule: 'A fan-out over a domain enum must reach one satisfies Record table -> never an object literal',
  });
  // The same rule cited against the document that also records it. `source`
  // left the tuple in issue #724, so this is the same finding.
  const otherSource = cited({
    source:
      'docs/adr/0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md',
  });
  const differentRule = cited({ ruleId: 'standard-missing-focused-test' });
  const differentAxis = cited({
    axis: 'spec',
    ruleId: 'spec-requirement-missing',
    source: '#123',
  });
  assert.equal(findingId(a), findingId(b));
  assert.equal(findingId(a), findingId(reworded));
  assert.equal(findingId(a), findingId(otherSource));
  assert.notEqual(findingId(a), findingId(c));
  assert.notEqual(findingId(a), findingId(differentRule));
  assert.notEqual(findingId(a), findingId(differentAxis));
});

// The decisive test for issue #718. Before the tuple dropped `rule`, the
// published record showed a persisting count of zero in 38 of 38 consecutive
// reports: every re-run reworded the rule text and so minted a fresh id, which
// announced live findings as resolved and closed their threads.
test('rewording the rule keeps the identity, so the finding persists across two runs', () => {
  const defect = (rule) =>
    cited({
      summary: 'reconcile() drops a blob type the server does not hold',
      rule,
    });
  const first = normalizeReport(
    envelope({
      findings: [
        defect(
          'A fan-out over a domain enum reaches the Pinned Table → never an object literal',
        ),
      ],
    }),
  );
  const second = normalizeReport(
    envelope({
      head: '9999999999999999999999999999999999999999',
      findings: [
        defect(
          'Fan-out over a domain enum must reach one satisfies Record table -> not an object literal',
        ),
      ],
    }),
  );
  assert.equal(second.findings[0].id, first.findings[0].id);
  const md = renderReport(second, first, { hunks: false });
  assert.match(md, /- new: 0\n/);
  assert.match(md, /- persisting: 1 \(`[0-9a-f]{12}`\)/);
  assert.match(md, /- resolved: 0\n/);
});

test('a previous report from another schema version is reported as not comparable', () => {
  const current = normalizeReport(envelope({ findings: [cited()] }));
  const older = { ...current, schemaVersion: REPORT_SCHEMA_VERSION - 1 };
  const md = renderReport(current, older, { hunks: false });
  assert.match(
    md,
    new RegExp(
      `No comparable previous run: the stored report is report schema \`${REPORT_SCHEMA_VERSION - 1}\`, this run is \`${REPORT_SCHEMA_VERSION}\``,
    ),
  );
  // No mass auto-resolve, and no strip at all: nothing is new, persisting, or
  // resolved against a report whose ids this run could never mint.
  assert.ok(!/- (new|persisting|resolved): /.test(md));
  // An artifact so old it has no version at all is named, not guessed at.
  assert.match(
    renderReport(current, { findings: [] }, { hunks: false }),
    /report schema `unknown`/,
  );
});

test('the renderer keeps the axes apart, folds nits, and diffs by id', () => {
  const current = normalizeReport(
    envelope({
      findings: [
        inferred({
          severity: 'nit',
          summary: 'Rename x',
          ruleId: 'smell-mysterious-name',
          rule: 'Mysterious Name',
          // Its own file, so it is a separate identity from the previous
          // run's unlocated smell-baseline finding rather than a collision.
          location: {
            file: 'libs/web-vault/src/digest.ts',
            startLine: 7,
            headSha: HEAD,
          },
        }),
        cited(),
        {
          axis: 'spec',
          severity: 'should-fix',
          summary: 'Scope creep: adds a toggle nobody asked for',
          ruleId: 'spec-behaviour-not-asked-for',
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
  // The rendered rule line carries the bounded id alongside the display text
  // and the source, so a human reading the report can see which catalogue
  // entry was chosen — the field the identity hashes (issue #724).
  assert.match(
    md,
    /- rule: `standard-enum-fanout-not-pinned` — Code fanning out over a domain enum reaches one satisfies Record table \(source: `AGENTS\.md`\)/,
  );
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
  // The catalogue's cap: every `smell-*` rule declares maxSeverity, so the
  // twelve smells are twelve capped identities rather than one opaque source.
  rejects(
    envelope({
      findings: [
        cited({
          ruleId: 'smell-feature-envy',
          source: 'smell-baseline',
          rule: 'Feature Envy',
        }),
      ],
    }),
    /findings\.0\.severity: a Feature Envy finding is a judgement call and caps at should-fix/,
  );
  // And the source's cap, which still stands on its own: a finding the
  // reviewer marked smell-baseline under some other rule id is the same
  // judgement call and must not slip between the two checks.
  rejects(
    envelope({ findings: [cited({ source: 'smell-baseline' })] }),
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
