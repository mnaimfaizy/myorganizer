// Covers how run facts reach a report and what the report says about them
// (issue #1031, ADR 0123): the validator overwrites, the renderer states, and
// nothing here fails a check or moves a tier.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { renderReport, renderRunFacts } from './render-review-report.mjs';
import {
  NormalizedReportSchema,
  REPORT_SCHEMA_VERSION,
  RunFactsSchema,
  UNKNOWN_MODEL,
  normalizeReport,
} from './schema.mjs';
import { readTranscriptFacts } from './transcript-facts.mjs';

const HEAD = 'abcdef1234567890abcdef1234567890abcdef12';
const BASE = '1234567890abcdef1234567890abcdef12345678';

/** A report as a reviewer writes it, with the run facts it claims. */
const envelope = (overrides = {}) => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  base: BASE,
  head: HEAD,
  tier: 'review:agent',
  spec: { kind: 'issue', ref: '#1031', foundBy: 'branch' },
  standardsSources: ['AGENTS.md', 'CLAUDE.md', 'libs/mobile/AGENTS.md'],
  executed: ['read spec.json'],
  suppressed: { redundant: 0 },
  model: 'a-model-the-reviewer-named',
  durationMs: 20000,
  findings: [],
  ...overrides,
});

const finding = (overrides = {}) => ({
  axis: 'standards',
  severity: 'should-fix',
  summary: 'Possible Feature Envy',
  ruleId: 'smell-feature-envy',
  source: 'smell-baseline',
  rule: 'Feature Envy',
  evidence: { kind: 'inferred', reasoning: 'reaches into another object' },
  location: { file: 'libs/a/src/x.ts', startLine: 3, headSha: HEAD },
  ...overrides,
});

const axis = (overrides = {}) => ({
  dispatched: true,
  briefRead: true,
  onTemplate: true,
  toolCalls: 12,
  ...overrides,
});

const facts = (overrides = {}) => ({
  schemaVersion: 1,
  shape: 'readable',
  shapeReason: null,
  cliVersion: '2.1.293',
  models: ['claude-sonnet-5-5'],
  durationMs: 112403,
  dispatches: 2,
  axes: { standards: axis(), spec: axis({ toolCalls: 8 }) },
  standardsSources: ['CODING_STANDARDS.md'],
  indexOpened: true,
  executed: ['node tools/scripts/check-review-rules.mjs'],
  ...overrides,
});

const unknownFacts = (overrides = {}) =>
  facts({
    shape: 'unknown',
    shapeReason: 'the transcript has no result event',
    models: null,
    durationMs: null,
    dispatches: null,
    axes: null,
    standardsSources: null,
    indexOpened: null,
    executed: null,
    ...overrides,
  });

const fixtureFacts = (name) =>
  readTranscriptFacts(
    readFileSync(
      new URL(`./fixtures/transcripts/${name}.json`, import.meta.url),
      'utf8',
    ),
    { index: null },
  );

// --- the facts file ---------------------------------------------------------

test('what the transcript reader writes is a run facts file', () => {
  for (const name of [
    'cli-2.1.292-paraphrased-dispatch',
    'cli-2.1.293-template-sequential-fenced',
    'cli-2.1.293-template',
  ])
    assert.ok(RunFactsSchema.safeParse(fixtureFacts(name)).success, name);
  assert.ok(RunFactsSchema.safeParse(readTranscriptFacts('')).success);
});

test('an unknown shape may not state a fact, and a readable one may not withhold one', () => {
  // An empty list under an unreadable transcript is the claim "none opened".
  assert.ok(
    !RunFactsSchema.safeParse(unknownFacts({ standardsSources: [] })).success,
  );
  assert.ok(!RunFactsSchema.safeParse(facts({ executed: null })).success);
  assert.ok(
    !RunFactsSchema.safeParse(unknownFacts({ shapeReason: null })).success,
  );
  assert.ok(!RunFactsSchema.safeParse(facts({ shapeReason: 'why' })).success);
});

// --- the overwrite ----------------------------------------------------------

test('with facts, the four run fields are the transcripts and not the reviewers', () => {
  const report = normalizeReport(envelope(), { facts: facts() });
  assert.deepEqual(report.standardsSources, ['CODING_STANDARDS.md']);
  assert.deepEqual(report.executed, [
    'node tools/scripts/check-review-rules.mjs',
  ]);
  assert.equal(report.durationMs, 112403);
  assert.equal(report.model, 'claude-sonnet-5-5');
  assert.equal(report.runFactsFrom, 'transcript');
  assert.equal(report.runFacts.cliVersion, '2.1.293');
  assert.ok(NormalizedReportSchema.safeParse(report).success);
});

test('every model that ran is named', () => {
  const report = normalizeReport(envelope(), {
    facts: facts({ models: ['claude-haiku-4-5', 'claude-sonnet-5-5'] }),
  });
  assert.equal(report.model, 'claude-haiku-4-5, claude-sonnet-5-5');
});

test('without facts, the report keeps the reviewers fields and says so', () => {
  const report = normalizeReport(envelope());
  assert.deepEqual(report.standardsSources, [
    'AGENTS.md',
    'CLAUDE.md',
    'libs/mobile/AGENTS.md',
  ]);
  assert.equal(report.model, 'a-model-the-reviewer-named');
  assert.equal(report.runFactsFrom, 'reviewer');
  assert.equal(report.runFacts, null);
  assert.ok(NormalizedReportSchema.safeParse(report).success);
});

test('unknown facts are recorded as unknown, never as the reviewers claim', () => {
  const report = normalizeReport(envelope(), { facts: unknownFacts() });
  assert.equal(report.standardsSources, null);
  assert.equal(report.executed, null);
  assert.equal(report.durationMs, null);
  assert.equal(report.model, UNKNOWN_MODEL);
  assert.equal(report.runFacts.shape, 'unknown');
  assert.equal(report.runFacts.axes, null);
  assert.ok(NormalizedReportSchema.safeParse(report).success);
});

test('an unknown shape keeps what the init and result events did say', () => {
  const report = normalizeReport(envelope(), {
    facts: unknownFacts({
      models: ['claude-sonnet-5-5'],
      durationMs: 60333,
      shapeReason: 'no sub-agent event is attributed',
    }),
  });
  assert.equal(report.model, 'claude-sonnet-5-5');
  assert.equal(report.durationMs, 60333);
  assert.equal(report.standardsSources, null);
});

test('findings under a transcript that shows no dispatch make the shape unknown', () => {
  const noDispatch = facts({
    dispatches: 0,
    axes: {
      standards: axis({
        dispatched: false,
        briefRead: false,
        onTemplate: null,
        toolCalls: 0,
      }),
      spec: axis({
        dispatched: false,
        briefRead: false,
        onTemplate: null,
        toolCalls: 0,
      }),
    },
    standardsSources: [],
    indexOpened: false,
    executed: [],
  });
  const withFinding = normalizeReport(envelope({ findings: [finding()] }), {
    facts: noDispatch,
  });
  assert.equal(withFinding.runFacts.shape, 'unknown');
  assert.match(withFinding.runFacts.shapeReason, /shows no sub-agent dispatch/);
  assert.equal(withFinding.standardsSources, null);

  // So does a report that names a standards source: the list is not
  // believed, but naming one says a Standards sub-agent ran. A CLI release
  // that renamed the dispatch tool would otherwise publish "none opened" on
  // every clean pull request.
  const namesASource = normalizeReport(envelope(), { facts: noDispatch });
  assert.equal(namesASource.runFacts.shape, 'unknown');
  assert.match(namesASource.runFacts.shapeReason, /names 3 standards source/);

  // No findings, no source named, and no dispatch is a reviewer that
  // dispatched nothing: a fact, and a readable one.
  const clean = normalizeReport(envelope({ standardsSources: [] }), {
    facts: noDispatch,
  });
  assert.equal(clean.runFacts.shape, 'readable');
  assert.deepEqual(clean.standardsSources, []);

  // An obligation finding is the main agent's own and proves no dispatch.
  const obligation = normalizeReport(
    envelope({
      standardsSources: [],
      findings: [
        finding({
          ruleId: 'obligation-run-the-gate-that-covers-this-change',
          source: 'docs/review/REVIEW_CHECKLIST.md',
        }),
      ],
    }),
    { facts: noDispatch },
  );
  assert.equal(obligation.runFacts.shape, 'readable');
});

test('facts change no finding, verdict, or tier', () => {
  const input = envelope({ findings: [finding()] });
  const plain = normalizeReport(input);
  // Every thin-review signal at once: nothing is enforced in this step.
  const thin = normalizeReport(input, {
    facts: facts({
      axes: {
        standards: axis({ briefRead: false, onTemplate: false }),
        spec: axis({ briefRead: false }),
      },
      standardsSources: [],
      indexOpened: false,
    }),
  });
  assert.deepEqual(thin.findings, plain.findings);
  assert.equal(thin.verdict, plain.verdict);
  assert.equal(thin.effectiveTier, plain.effectiveTier);
});

test('a report normalized before run facts existed still parses as a previous report', () => {
  const older = normalizeReport(envelope({ findings: [finding()] }));
  delete older.runFactsFrom;
  delete older.runFacts;
  assert.ok(NormalizedReportSchema.safeParse(older).success);
  const next = normalizeReport(envelope({ findings: [finding()] }), {
    previous: older,
    facts: facts(),
  });
  assert.equal(next.findings[0].id, older.findings[0].id);
});

// --- what the comment says --------------------------------------------------

const lines = (report) => renderRunFacts(report).join('\n');

test('a transcript-read report lists what was opened, with the harness note', () => {
  const text = lines(normalizeReport(envelope(), { facts: facts() }));
  assert.match(
    text,
    /read from the reviewer transcript \(Claude Code CLI 2\.1\.293\)/,
  );
  assert.match(
    text,
    /opened by the Standards sub-agent: `CODING_STANDARDS\.md`/,
  );
  assert.match(
    text,
    /root `AGENTS\.md` and `CLAUDE\.md` are loaded by the harness/,
  );
  assert.match(text, /sub-agent tool calls: Standards 12 · Spec 8/);
  assert.doesNotMatch(text, /not read|not opened|beyond the skill/);
});

test('each thin-review fact gets its own line', () => {
  const text = lines(
    normalizeReport(envelope(), {
      facts: facts({
        axes: {
          standards: axis({ onTemplate: false }),
          spec: axis({ briefRead: false, toolCalls: 3 }),
        },
        standardsSources: [],
        indexOpened: false,
      }),
    }),
  );
  assert.match(text, /opened by the Standards sub-agent: \*\*none\*\*/);
  assert.match(
    text,
    /Standards dispatch: \*\*carried text beyond the skill's template\*\*/,
  );
  assert.match(text, /Spec brief: \*\*not read\*\*/);
  assert.match(text, /standards index: \*\*not opened\*\*/);
});

test('a reply that is not a bare JSON object gets a line', () => {
  const text = lines(
    normalizeReport(envelope(), {
      facts: facts({
        axes: { standards: axis(), spec: axis({ replyIsJson: false }) },
      }),
    }),
  );
  assert.match(text, /Spec reply: \*\*not a bare JSON object\*\*/);
  assert.doesNotMatch(text, /Standards reply/);
});

test('an unread Standards brief is not also reported as an unopened index', () => {
  const text = lines(
    normalizeReport(envelope(), {
      facts: facts({
        axes: { standards: axis({ briefRead: false }), spec: axis() },
        standardsSources: [],
        indexOpened: false,
      }),
    }),
  );
  assert.match(text, /Standards brief: \*\*not read\*\*/);
  assert.doesNotMatch(text, /standards index/);
});

test('with no spec, the Spec axis is not reported as missing its brief', () => {
  const text = lines(
    normalizeReport(envelope({ spec: { kind: 'none', foundBy: 'none' } }), {
      facts: facts({
        dispatches: 1,
        axes: {
          standards: axis(),
          spec: axis({
            dispatched: false,
            briefRead: false,
            onTemplate: null,
            toolCalls: 0,
          }),
        },
      }),
    }),
  );
  assert.match(text, /Spec not run/);
  assert.doesNotMatch(text, /Spec brief/);
});

test('unknown is printed as unknown, not as none', () => {
  const text = lines(normalizeReport(envelope(), { facts: unknownFacts() }));
  assert.match(text, /run facts: \*\*unknown\*\*/);
  assert.match(text, /the transcript has no result event/);
  assert.match(text, /standards sources opened: unknown/);
  assert.doesNotMatch(text, /none/);
  const md = renderReport(
    normalizeReport(envelope(), { facts: unknownFacts() }),
    null,
    { hunks: false },
  );
  assert.match(md, /model: unknown · duration unknown/);
});

test('an interactive report says its run facts are self-reported', () => {
  const text = lines(normalizeReport(envelope()));
  assert.match(text, /self-reported by the reviewer/);
  assert.match(text, /as the reviewer listed them/);
});

test('a path cannot end its own code span', () => {
  const text = lines(
    normalizeReport(envelope(), {
      facts: facts({ standardsSources: ['docs/adr/a`b.md'] }),
    }),
  );
  assert.match(text, /`docs\/adr\/ab\.md`/);
});

// --- the two commands -------------------------------------------------------

const run = (script, args) =>
  spawnSync('node', [`tools/scripts/review/${script}`, ...args], {
    encoding: 'utf8',
  });

test('the facts command writes a file the validator takes, end to end', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-facts-'));
  const factsPath = join(dir, 'facts.json');
  const read = run('read-transcript-facts.mjs', [
    'tools/scripts/review/fixtures/transcripts/cli-2.1.293-template.json',
    '--index',
    'CODING_STANDARDS.md',
    '--out',
    factsPath,
  ]);
  assert.equal(read.status, 0, read.stderr);
  assert.match(read.stdout, /Claude Code CLI 2\.1\.293/);

  const reportPath = join(dir, 'report.json');
  const out = join(dir, 'normalized.json');
  writeFileSync(reportPath, JSON.stringify(envelope()));
  const validated = run('validate-review-report.mjs', [
    reportPath,
    '--facts',
    factsPath,
    '--out',
    out,
  ]);
  assert.equal(validated.status, 0, validated.stderr);
  const normalized = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(normalized.runFactsFrom, 'transcript');
  assert.deepEqual(normalized.standardsSources, ['CODING_STANDARDS.md']);
  assert.equal(normalized.durationMs, 112403);
});

test('a missing transcript is written down as unknown, with an annotation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-facts-'));
  const factsPath = join(dir, 'facts.json');
  const read = run('read-transcript-facts.mjs', [
    join(dir, 'no-such-file.json'),
    '--out',
    factsPath,
  ]);
  assert.equal(read.status, 0);
  assert.match(
    read.stdout,
    /^::error::the reviewer transcript could not be read/,
  );
  assert.equal(JSON.parse(readFileSync(factsPath, 'utf8')).shape, 'unknown');
});

test('the validator annotates a transcript that reads cleanly and cannot be right', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-facts-'));
  const reportPath = join(dir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(envelope()));
  const factsPath = join(dir, 'facts.json');
  writeFileSync(
    factsPath,
    JSON.stringify(
      facts({
        dispatches: 0,
        axes: {
          standards: axis({
            dispatched: false,
            briefRead: false,
            onTemplate: null,
            toolCalls: 0,
          }),
          spec: axis({
            dispatched: false,
            briefRead: false,
            onTemplate: null,
            toolCalls: 0,
          }),
        },
        standardsSources: [],
        indexOpened: false,
        executed: [],
      }),
    ),
  );
  const validated = run('validate-review-report.mjs', [
    reportPath,
    '--facts',
    factsPath,
    '--out',
    join(dir, 'normalized.json'),
  ]);
  assert.equal(validated.status, 0, validated.stderr);
  assert.match(
    validated.stdout,
    /^::error::the reviewer transcript does not account for this report \(Claude Code CLI 2\.1\.293\)/,
  );
});

test('the facts command needs somewhere to write', () => {
  assert.equal(run('read-transcript-facts.mjs', ['x.json']).status, 2);
});

test('the validator refuses a facts file that is not one, rather than fall back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-facts-'));
  const reportPath = join(dir, 'report.json');
  writeFileSync(reportPath, JSON.stringify(envelope()));
  const bad = join(dir, 'facts.json');
  writeFileSync(bad, JSON.stringify({ shape: 'readable' }));
  assert.equal(
    run('validate-review-report.mjs', [reportPath, '--facts', bad]).status,
    2,
  );
  assert.equal(
    run('validate-review-report.mjs', [
      reportPath,
      '--facts',
      join(dir, 'absent.json'),
    ]).status,
    2,
  );
});
