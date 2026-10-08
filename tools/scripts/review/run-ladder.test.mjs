// Covers what a run fact costs (issue #1031, ADR 0123 items 4 and 5): one
// test group per row of the consequence ladder, each against a transcript.
//
// Where a real CI run shows the row, its fixture is used as cut:
//
//   cli-2.1.292-paraphrased-dispatch    run 37576528356 — neither brief read,
//     and a returned finding the main agent rewrote one field of.
//   cli-2.1.293-template-two-findings   run 37717857861 — on template, both
//     briefs read, the index opened, and each sub-agent returned one finding
//     that the report carries unchanged. The report is the one the main agent
//     wrote in that run, read out of its own Write call.
//
// No real run shows the other rows, so they are derived here: a real
// transcript with one thing changed, and the change named in the test. That
// keeps the shape the CLI's and makes the one difference the thing under
// test, which a hand-written transcript would not.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { BRIEFS } from './briefs.mjs';
import { renderRunFacts } from './render-review-report.mjs';
import {
  RUN_FAILURES,
  TIGHTENING_FACTS,
  isObligationFinding,
} from './run-ladder.mjs';
import {
  NormalizedReportSchema,
  REVIEW_TIER_LABELS,
  normalizeReport,
} from './schema.mjs';
import { STANDARDS_INDEX, readTranscriptFacts } from './transcript-facts.mjs';

const TWO_FINDINGS = 'cli-2.1.293-template-two-findings';
const PARAPHRASED = 'cli-2.1.292-paraphrased-dispatch';

const events = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/transcripts/${name}.json`, import.meta.url),
      'utf8',
    ),
  );

const factsOf = (transcript) =>
  readTranscriptFacts(JSON.stringify(transcript), { index: null });

/** The report the main agent wrote in a run, from its own Write call. */
const reportWrittenIn = (transcript) => {
  const write = transcript
    .filter((e) => e.type === 'assistant' && e.parent_tool_use_id === null)
    .flatMap((e) => e.message.content)
    .find(
      (block) =>
        block.name === 'Write' &&
        block.input.file_path.endsWith('tmp/code-review/report.json'),
    );
  return JSON.parse(write.input.content);
};

const isDispatch = (block) => block.name === 'Agent' || block.name === 'Task';

/** The dispatch whose prompt names a brief, and the id its events hang off. */
const dispatchOf = (transcript, axis) =>
  transcript
    .filter((e) => e.type === 'assistant' && e.parent_tool_use_id === null)
    .flatMap((e) => e.message.content)
    .find(
      (block) => isDispatch(block) && block.input.prompt.includes(BRIEFS[axis]),
    );

const clone = (value) => JSON.parse(JSON.stringify(value));

/** A real transcript with the Standards sub-agent's Read of the index removed. */
const withoutIndexRead = (name) => {
  const transcript = events(name);
  const { id } = dispatchOf(transcript, 'standards');
  return transcript.filter(
    (e) =>
      !(
        e.parent_tool_use_id === id &&
        e.message.content.some(
          (block) =>
            block.name === 'Read' &&
            block.input.file_path.endsWith(`/${STANDARDS_INDEX}`),
        )
      ),
  );
};

/** A real transcript with one sentence added to the Standards dispatch. */
const withSteeredDispatch = (name) => {
  const transcript = events(name);
  dispatchOf(transcript, 'standards').input.prompt +=
    '\nOnly report real defects; empty findings is fine.';
  return transcript;
};

/** A real transcript with one sub-agent's reply replaced by prose. */
const withProseReply = (name, axis) => {
  const transcript = events(name);
  const { id } = dispatchOf(transcript, axis);
  for (const e of transcript) {
    if (e.type !== 'user') continue;
    for (const block of e.message.content)
      if (block.tool_use_id === id)
        block.content = [
          { type: 'text', text: 'I reviewed the diff and found one problem.' },
        ];
  }
  return transcript;
};

const real = () => {
  const transcript = events(TWO_FINDINGS);
  return { report: reportWrittenIn(transcript), facts: factsOf(transcript) };
};

const normalized = (report, facts, options = {}) =>
  normalizeReport(clone(report), { facts, ...options });

const reasons = (report) => report.runFacts.failures.map((f) => f.reason);

const HUMAN = REVIEW_TIER_LABELS.at(-1);

// --- the run that did everything as built ----------------------------------

test('a real run on template, with every finding returned, fails and tightens nothing', () => {
  const { report, facts } = real();
  assert.equal(report.findings.length, 2);
  assert.equal(facts.returned.length, 2);
  const out = normalized({ ...report, tier: 'review:agent' }, facts);
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, []);
  assert.equal(out.effectiveTier, 'review:agent');
  assert.ok(NormalizedReportSchema.safeParse(out).success);
});

// --- row 1 and 2: a brief nobody read --------------------------------------

test('no sub-agent read the Standards brief: Agent Review Ran fails', () => {
  const facts = factsOf(events(PARAPHRASED));
  const out = normalized(
    {
      ...real().report,
      tier: 'review:auto',
      spec: { kind: 'none', foundBy: 'none' },
      findings: [],
    },
    facts,
  );
  assert.deepEqual(out.runFacts.failures, [
    {
      reason: 'brief-not-read',
      axis: 'standards',
      detail: 'no sub-agent read the Standards brief, and no dispatch named it',
    },
  ]);
  // A review that did not run as built vouches for nothing.
  assert.equal(out.effectiveTier, HUMAN);
});

test('the spec is not none and no sub-agent read the Spec brief: it fails for that axis too', () => {
  const facts = factsOf(events(PARAPHRASED));
  const out = normalized({ ...real().report, findings: [] }, facts);
  assert.deepEqual(
    out.runFacts.failures.map((f) => [f.reason, f.axis]),
    [
      ['brief-not-read', 'standards'],
      ['brief-not-read', 'spec'],
    ],
  );
});

// --- row 3: a finding the main agent changed or wrote ----------------------

test('run 37576528356: the main agent rewrote a returned confidence of 0.6 to "medium"', () => {
  const facts = factsOf(events(PARAPHRASED));
  // The dispatch named no brief, so no axis is attributed to it. Its
  // sub-agent returned a finding all the same, and it is compared like any
  // other: the reply is read whether or not the dispatch was on template.
  assert.equal(facts.returned.length, 1);
  assert.equal(facts.returned[0].confidence, 0.6);
  // What the report carried: the same finding with the one field rewritten
  // so it would pass the contract.
  const rewritten = { ...facts.returned[0], confidence: 'medium' };
  const out = normalized({ ...real().report, findings: [rewritten] }, facts);
  const changed = out.runFacts.failures.filter(
    (f) => f.reason === 'finding-not-returned',
  );
  assert.equal(changed.length, 1);
  assert.match(changed[0].detail, /differs .* in: confidence$/);
});

test('a reported finding that differs from the returned one fails, and names the field', () => {
  const { report, facts } = real();
  const changed = clone(report);
  changed.findings[0].severity = 'should-fix';
  const out = normalized(changed, facts);
  assert.deepEqual(reasons(out), ['finding-not-returned']);
  assert.match(out.runFacts.failures[0].detail, /differs .* in: severity$/);
  assert.equal(out.runFacts.failures[0].axis, changed.findings[0].axis);
  assert.equal(out.effectiveTier, HUMAN);
  // The report is not rejected: its findings are still published.
  assert.equal(out.findings.length, 2);
  assert.equal(out.verdict, 'comment');
});

test('a reported finding no sub-agent returned fails', () => {
  const { report, facts } = real();
  const authored = clone(report);
  authored.findings.push({
    ...clone(report.findings[0]),
    ruleId: 'smell-feature-envy',
    summary: 'Something the main agent noticed on its own',
  });
  const out = normalized(authored, facts);
  assert.deepEqual(reasons(out), ['finding-not-returned']);
  assert.match(out.runFacts.failures[0].detail, /^no sub-agent returned/);
});

test('key order is not a difference, and neither is the id the validator adds', () => {
  const { report, facts } = real();
  const reordered = clone(report);
  reordered.findings = reordered.findings.map((f) =>
    Object.fromEntries(Object.entries(f).reverse()),
  );
  assert.deepEqual(normalized(reordered, facts).runFacts.failures, []);
});

test('dropping a returned finding is not a change', () => {
  // The one-axis-per-defect rule drops a Standards finding at assembly.
  const { report, facts } = real();
  const out = normalized({ ...report, findings: [report.findings[1]] }, facts);
  assert.deepEqual(out.runFacts.failures, []);
});

test('an obligation finding at a worklist site has no sub-agent origin and is not a failure', () => {
  const { report, facts } = real();
  const site = 'libs/web/ui/src/dialog.tsx';
  const obligation = {
    ...clone(report.findings[0]),
    ruleId: 'obligation-destructive-confirmation-names-what-it-mutates',
    location: { ...report.findings[0].location, file: site },
  };
  const withIt = { ...report, findings: [...report.findings, obligation] };
  const entry = {
    id: 'destructive-confirmation-names-what-it-mutates',
    sites: [{ file: site, line: 4 }],
    truncated: 0,
  };

  const worklist = { head: report.head, selected: [entry] };
  assert.deepEqual(
    normalized(withIt, facts, { worklist }).runFacts.failures,
    [],
  );

  // No worklist, an entry for another obligation, or a site in another
  // file: nothing names this finding as the main agent's to write.
  for (const other of [
    null,
    { selected: [] },
    { selected: [{ ...entry, id: 'env-assignment-runtime-value' }] },
    { selected: [{ ...entry, sites: [{ file: 'libs/other.ts', line: 1 }] }] },
  ])
    assert.deepEqual(
      reasons(normalized(withIt, facts, { worklist: other })),
      ['finding-not-returned'],
      JSON.stringify(other),
    );

  // A truncated entry names only some of its sites, so any file passes.
  assert.ok(
    isObligationFinding(obligation, {
      selected: [{ ...entry, sites: [], truncated: 3 }],
    }),
  );
});

// --- row 4: the index never opened -----------------------------------------

test('Standards brief read and CODING_STANDARDS.md never opened: the tier tightens and the check does not fail', () => {
  const { report } = real();
  // Derived: run 37717857861 with the Standards sub-agent's Read of the
  // index taken out.
  const facts = factsOf(withoutIndexRead(TWO_FINDINGS));
  assert.equal(facts.axes.standards.briefRead, true);
  assert.equal(facts.indexOpened, false);
  const out = normalized({ ...report, tier: 'review:auto' }, facts);
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, ['index-not-opened']);
  assert.equal(out.effectiveTier, 'review:agent');
});

// --- row 5: a dispatch off the template ------------------------------------

test('a dispatch carrying text beyond the template tightens the tier', () => {
  const { report } = real();
  // Derived: the same run with one of the two sentences run 37576528356
  // added to its dispatches appended to the Standards one.
  const facts = factsOf(withSteeredDispatch(TWO_FINDINGS));
  assert.equal(facts.axes.standards.onTemplate, false);
  const out = normalized({ ...report, tier: 'review:agent' }, facts);
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, ['dispatch-off-template']);
  assert.equal(out.effectiveTier, HUMAN);
});

// --- row 6: cannot tell -----------------------------------------------------

test('a transcript that cannot be read tightens the tier and fails nothing', () => {
  const { report } = real();
  // Derived: the same run with its result event cut off.
  const facts = factsOf(
    events(TWO_FINDINGS).filter((e) => e.type !== 'result'),
  );
  assert.equal(facts.shape, 'unknown');
  const out = normalized({ ...report, tier: 'review:auto' }, facts);
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, ['transcript-unreadable']);
  assert.equal(out.effectiveTier, 'review:agent');
});

test('a transcript that shows no dispatch under a report with findings is unknown, not a failure', () => {
  const { report } = real();
  // Derived: the same run with both dispatches renamed, as a CLI release
  // that renamed the tool would leave it.
  const transcript = events(TWO_FINDINGS);
  for (const e of transcript)
    if (e.type === 'assistant')
      for (const block of e.message.content)
        if (isDispatch(block)) block.name = 'Delegate';
  const out = normalized(
    { ...report, tier: 'review:auto' },
    factsOf(transcript),
  );
  assert.equal(out.runFacts.shape, 'unknown');
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, ['transcript-unreadable']);
});

test('a reply that cannot be parsed tightens the tier, and its findings are not failed', () => {
  const { report } = real();
  // Derived: the same run with the Standards sub-agent's reply replaced by
  // a sentence.
  const facts = factsOf(withProseReply(TWO_FINDINGS, 'standards'));
  assert.equal(facts.repliesParsed, false);
  assert.equal(facts.returned.length, 1);
  const out = normalized({ ...report, tier: 'review:auto' }, facts);
  // The Standards finding is not among the returned ones, and the reply
  // that may have held it could not be read: that is "cannot tell".
  assert.deepEqual(out.runFacts.failures, []);
  assert.deepEqual(out.runFacts.tightenedBy, ['reply-unparseable']);
  assert.equal(out.effectiveTier, 'review:agent');
});

test('a fenced reply broke the brief and is still read for what it returned', () => {
  const facts = factsOf(events('cli-2.1.293-template-sequential-fenced'));
  assert.equal(facts.axes.standards.replyIsJson, false);
  assert.equal(facts.repliesParsed, true);
  assert.deepEqual(facts.returned, []);
});

// --- how the steps combine ---------------------------------------------------

test('tightening facts cost one step together, on top of the step a missing spec costs', () => {
  const { report } = real();
  const transcript = withSteeredDispatch(TWO_FINDINGS);
  const { id } = dispatchOf(transcript, 'standards');
  const facts = factsOf(
    transcript.filter(
      (e) =>
        !(
          e.parent_tool_use_id === id &&
          e.message.content.some((b) =>
            b.input.file_path?.endsWith(`/${STANDARDS_INDEX}`),
          )
        ),
    ),
  );
  const thin = (overrides) =>
    normalized({ ...report, findings: [], ...overrides }, facts);

  assert.deepEqual(thin({}).runFacts.tightenedBy, [
    'index-not-opened',
    'dispatch-off-template',
  ]);
  assert.equal(thin({ tier: 'review:auto' }).effectiveTier, 'review:agent');
  assert.equal(thin({ tier: 'review:human' }).effectiveTier, 'review:human');
  // An interactive run has no label to tighten; the facts are still recorded.
  assert.equal(thin({ tier: null }).effectiveTier, null);
});

test('with no spec, a tightening fact is the second step', () => {
  // Derived: the same run with the index Read removed. The Spec sub-agent
  // ran in it, which a report with no spec does not need and is not failed for.
  const facts = factsOf(withoutIndexRead(TWO_FINDINGS));
  const out = normalized(
    {
      ...real().report,
      tier: 'review:auto',
      spec: { kind: 'none', foundBy: 'none' },
      findings: [],
    },
    facts,
  );
  assert.deepEqual(out.runFacts.failures, []);
  assert.equal(out.effectiveTier, HUMAN);
});

test('without a facts file nothing is judged', () => {
  const out = normalizeReport(clone(real().report));
  assert.equal(out.runFacts, null);
  assert.equal(out.effectiveTier, 'review:human');
});

// --- what the comment says ---------------------------------------------------

test('a failure is published as the reason the check fails', () => {
  const { report, facts } = real();
  const changed = clone(report);
  changed.findings[0].severity = 'should-fix';
  const text = renderRunFacts(normalized(changed, facts)).join('\n');
  assert.match(
    text,
    /\*\*`Agent Review Ran` fails\*\* \(`finding-not-returned`\)/,
  );
  assert.doesNotMatch(text, /tier tightened/);
});

test('a tightened tier is published with what tightened it', () => {
  const { report } = real();
  const facts = factsOf(withoutIndexRead(TWO_FINDINGS));
  const text = renderRunFacts(
    normalized({ ...report, tier: 'review:auto' }, facts),
  ).join('\n');
  assert.match(text, /standards index: \*\*not opened\*\*/);
  assert.match(
    text,
    /tier tightened one step toward a human by: `index-not-opened`/,
  );
  const interactive = renderRunFacts(
    normalized({ ...report, tier: null }, facts),
  ).join('\n');
  assert.match(interactive, /would tighten a tier: `index-not-opened`/);
});

test('an unparseable reply and an unreadable transcript each get a line', () => {
  const { report } = real();
  assert.match(
    renderRunFacts(
      normalized(report, factsOf(withProseReply(TWO_FINDINGS, 'spec'))),
    ).join('\n'),
    /sub-agent replies: \*\*not all readable\*\*/,
  );
  assert.match(
    renderRunFacts(
      normalized(
        { ...report, tier: 'review:auto' },
        factsOf(events(TWO_FINDINGS).filter((e) => e.type !== 'result')),
      ),
    ).join('\n'),
    /tier tightened one step toward a human by: `transcript-unreadable`/,
  );
});

// --- the vocabularies and the CLI -------------------------------------------

test('the ladder names two failures and four tightening facts', () => {
  assert.deepEqual(RUN_FAILURES, ['brief-not-read', 'finding-not-returned']);
  assert.deepEqual(TIGHTENING_FACTS, [
    'index-not-opened',
    'dispatch-off-template',
    'transcript-unreadable',
    'reply-unparseable',
  ]);
});

const VALIDATOR = new URL('./validate-review-report.mjs', import.meta.url)
  .pathname;

const validate = (report, facts, extra = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'run-ladder-'));
  const paths = {
    report: join(dir, 'report.json'),
    facts: join(dir, 'facts.json'),
    out: join(dir, 'normalized.json'),
  };
  writeFileSync(paths.report, JSON.stringify(report));
  writeFileSync(paths.facts, JSON.stringify(facts));
  const run = spawnSync(
    process.execPath,
    [
      VALIDATOR,
      paths.report,
      '--facts',
      paths.facts,
      '--out',
      paths.out,
      ...extra,
    ],
    { encoding: 'utf8' },
  );
  return { run, dir, out: paths.out };
};

test('the validator writes a failed run and exits 0, so the findings are still published', () => {
  const { report, facts } = real();
  const changed = clone(report);
  changed.findings[0].severity = 'should-fix';
  const { run, out } = validate(changed, facts);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /run failure \(finding-not-returned\)/);
  const written = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(reasons(written), ['finding-not-returned']);
  assert.equal(written.findings.length, 2);
});

test('--worklist names the obligation findings, and a path that does not exist is no worklist', () => {
  const { report, facts } = real();
  const site = 'libs/web/ui/src/dialog.tsx';
  const withIt = clone(report);
  withIt.findings.push({
    ...clone(report.findings[0]),
    ruleId: 'obligation-destructive-confirmation-names-what-it-mutates',
    location: { ...report.findings[0].location, file: site },
  });

  const missing = validate(withIt, facts, [
    '--worklist',
    '/nonexistent/w.json',
  ]);
  assert.equal(missing.run.status, 0, missing.run.stderr);
  assert.deepEqual(reasons(JSON.parse(readFileSync(missing.out, 'utf8'))), [
    'finding-not-returned',
  ]);

  const dir = mkdtempSync(join(tmpdir(), 'run-ladder-w-'));
  const worklist = join(dir, 'obligations.json');
  writeFileSync(
    worklist,
    JSON.stringify({
      head: report.head,
      selected: [
        {
          id: 'destructive-confirmation-names-what-it-mutates',
          sites: [{ file: site, line: 4 }],
          truncated: 0,
        },
      ],
    }),
  );
  const named = validate(withIt, facts, ['--worklist', worklist]);
  assert.equal(named.run.status, 0, named.run.stderr);
  assert.deepEqual(reasons(JSON.parse(readFileSync(named.out, 'utf8'))), []);

  writeFileSync(worklist, 'not json');
  assert.equal(validate(withIt, facts, ['--worklist', worklist]).run.status, 2);
});
