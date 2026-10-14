/**
 * What a run fact costs (issue #1031, ADR 0123 items 4 and 5; issue #1039,
 * ADR 0126).
 *
 * `transcript-facts.mjs` reads a reviewer transcript and decides nothing.
 * This module decides, from those facts and the report, in two kinds:
 *
 *   - a **failure** fails `Agent Review Ran`. It is a fact about the
 *     pipeline (ADR 0073): an axis did not run as built, the main agent
 *     authored a finding, or a finding gives as executed evidence a command
 *     or an exit code the transcript does not bear out.
 *   - a **tightening fact** is published and moves the effective tier one
 *     step toward a human. It says the review was thin or cannot be vouched
 *     for, which is not a broken gate (ADR 0078): run 37576528356 skipped
 *     the standards index and still found a real gap.
 *
 * "Cannot tell" is never a failure. A transcript this reader cannot account
 * for, or a reply it cannot parse, tightens the tier and fails nothing, so a
 * Claude Code CLI release that moves the transcript's shape reads as a
 * visible "unknown" and not as a red check on every pull request.
 *
 * Pure: no file is read here. `normalizeReport` in schema.mjs is the caller.
 */
import { matchExecutedEvidence } from './executed-evidence.mjs';
import { obligationRuleId } from './obligations.mjs';
import { RUN_FAILURES, TIGHTENING_FACTS } from './run-ladder-terms.mjs';

export { RUN_FAILURES, TIGHTENING_FACTS };

const AXIS_NAMES = { standards: 'Standards', spec: 'Spec' };

const isObject = (v) => typeof v === 'object' && v !== null;

/** A value with every object's keys in one order, for comparison. */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  );
};

const sameValue = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** The fields two findings disagree on, by top-level name. */
const fieldsThatDiffer = (reported, returned) =>
  [...new Set([...Object.keys(reported), ...Object.keys(returned)])]
    .filter((key) => !sameValue(reported[key], returned[key]))
    .sort();

const where = (finding) =>
  finding.location?.file
    ? `${finding.location.file}:${finding.location.startLine}`
    : 'no location';

/**
 * Whether a finding is one the main agent is meant to write itself: an
 * answer in the obligation worklist met its entry's `defectWhen`, and the
 * finding carries that obligation's mirrored rule id at a site the worklist
 * names (the skill's step 4).
 *
 * Matched as `raisedForSite` in obligations.mjs matches: by rule id and the
 * site's file, and a finding with no location counts. The obligation check
 * and this one read the same two files, and a finding the first counts as
 * raised must not be failed by the second as authored. A worklist entry that
 * was truncated names only some of its sites, so any file passes for it.
 *
 * @param {object} finding a reported finding
 * @param {unknown} worklist the selector's output, or null when there is none
 */
export const isObligationFinding = (finding, worklist) => {
  const selected = Array.isArray(worklist?.selected) ? worklist.selected : [];
  return selected.some(
    (entry) =>
      isObject(entry) &&
      obligationRuleId(entry.id) === finding.ruleId &&
      (finding.location?.file === undefined ||
        entry.truncated > 0 ||
        (Array.isArray(entry.sites) &&
          entry.sites.some((site) => site?.file === finding.location.file))),
  );
};

/** A model-written command as one bounded line of a failure's detail. */
const oneLine = (command) => {
  const line = command.replace(/\s+/g, ' ').trim();
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
};

/**
 * The failure a finding's executed evidence earns, or `null` (ADR 0126).
 *
 * The matching rule, and what it allows as a near-miss, is written down in
 * `executed-evidence.mjs`. A sub-agent's finding is held to the commands
 * sub-agents ran. An obligation finding is the main agent's own, so the
 * command behind it may be the main agent's too.
 *
 * The finding is not touched. Evidence nobody executed is a fact about the
 * reviewer, like a citation that does not match its source (ADR 0078): the
 * report is published whole and the check fails beside it.
 */
const evidenceFailure = (finding, executions, isObligation) => {
  if (finding.evidence?.kind !== 'executed') return null;
  const match = matchExecutedEvidence(
    finding.evidence,
    isObligation ? executions : executions.filter((e) => e.by === 'sub-agent'),
  );
  if (match.status === 'ran') return null;
  const which = `the ${finding.ruleId} finding at ${where(finding)}`;
  const command = oneLine(finding.evidence.command);
  return {
    reason: 'evidence-not-executed',
    axis: finding.axis,
    detail:
      match.status === 'not-run'
        ? `${isObligation ? 'neither the main agent nor a sub-agent' : 'no sub-agent'} ran the command ${which} gives as executed evidence: ${command}`
        : `${which} gives exit code ${finding.evidence.exitCode} for a command the transcript shows it exiting ${match.exitCodes.join(' and ')}: ${command}`,
  };
};

/**
 * Code that runs, for the Spec brief's trace (issue #1140): a workflow or an
 * action, or a script. Its defects sit in how a changed line meets an unchanged
 * one, so a hunk is not enough and the bar is the whole file, opened.
 */
const EXECUTABLE = [
  /^\.github\/(?:workflows|actions)\//,
  /\.(?:sh|mjs|cjs)$/,
  /^tools\/.*\.(?:js|ts)$/,
];
export const isExecutable = (file) => EXECUTABLE.some((re) => re.test(file));

const coverageOf = (axis, file) => {
  if (axis?.opened?.includes(file)) return 'opened';
  const diffedHere = (path) => file === path || file.startsWith(`${path}/`);
  if (axis?.diffed?.some(diffedHere)) return 'diffed';
  return 'neither';
};

/**
 * Each changed file, on each axis: opened (its content came back), diffed (a
 * diff named it or a directory above it), or neither. The changed-file list is
 * the selector's, never the reviewer's; with none, there is nothing to say.
 *
 * @param {object} facts the run facts
 * @param {unknown} worklist the obligation worklist, when one was selected
 * @returns {{ file: string, added: number, standards: string, spec: string }[] | null}
 */
export const fileCoverage = (facts, worklist) => {
  if (!Array.isArray(worklist?.changedFiles)) return null;
  return worklist.changedFiles.map(({ file, added }) => ({
    file,
    added,
    standards: coverageOf(facts.axes.standards, file),
    spec: coverageOf(facts.axes.spec, file),
  }));
};

/**
 * Judge one run.
 *
 * @param {object} run
 * @param {object} run.facts the run facts, as `RunFactsSchema` parses them
 * @param {boolean} run.readable whether the facts account for the report;
 *   `normalizeReport` may read a clean transcript as unknown
 * @param {object[]} run.findings the report's findings, as the reviewer wrote
 *   them and before an id is added
 * @param {string} run.specKind the report's `spec.kind`
 * @param {unknown} [run.worklist] the obligation worklist, when one was selected
 * @returns {{
 *   failures: { reason: string, axis: string | null, detail: string }[],
 *   tightenedBy: string[],
 * }}
 */
export const judgeRun = ({
  facts,
  readable,
  findings,
  specKind,
  worklist = null,
}) => {
  if (!readable)
    return { failures: [], tightenedBy: ['transcript-unreadable'] };

  const failures = [];
  const tightenedBy = new Set();

  // An axis that was meant to run: Standards always, Spec when there is one.
  const expected = { standards: true, spec: specKind !== 'none' };
  for (const axis of Object.keys(AXIS_NAMES)) {
    const a = facts.axes[axis];
    if (expected[axis] && !a.briefRead)
      failures.push({
        reason: 'brief-not-read',
        axis,
        detail: `no sub-agent read the ${AXIS_NAMES[axis]} brief${a.dispatched ? '' : ', and no dispatch named it'}`,
      });
    if (a.dispatched && a.onTemplate === false)
      tightenedBy.add('dispatch-off-template');
  }
  // A dispatch that is neither axis's is one the skill has no template for.
  // Its findings still count as returned, so without this a main agent could
  // hand its own finding to a third sub-agent and report it on a run that
  // reads as fully on template.
  if (facts.unattributedDispatches > 0)
    tightenedBy.add('dispatch-off-template');
  if (facts.axes.standards.briefRead && !facts.indexOpened)
    tightenedBy.add('index-not-opened');
  if (facts.repliesParsed === false) tightenedBy.add('reply-unparseable');
  // Thin, not broken: a Spec pass that never opened a changed workflow or
  // script can still be right, and says so in the published coverage table.
  if (
    expected.spec &&
    fileCoverage(facts, worklist)?.some(
      (c) => isExecutable(c.file) && c.spec !== 'opened',
    )
  )
    tightenedBy.add('spec-axis-left-executable-file-unopened');

  // Facts read before the calls were kept say nothing about them, and
  // "cannot tell" is never a failure.
  if (Array.isArray(facts.executions))
    for (const finding of findings) {
      const failure = evidenceFailure(
        finding,
        facts.executions,
        isObligationFinding(finding, worklist),
      );
      if (failure) failures.push(failure);
    }

  for (const finding of findings) {
    if (isObligationFinding(finding, worklist)) continue;
    if (facts.returned.some((r) => sameValue(r, finding))) continue;
    // A reply that could not be parsed may have returned this finding.
    if (facts.repliesParsed === false) continue;
    const near = facts.returned.find(
      (r) =>
        r.axis === finding.axis &&
        r.ruleId === finding.ruleId &&
        r.location?.file === finding.location?.file,
    );
    failures.push({
      reason: 'finding-not-returned',
      axis: finding.axis,
      detail: near
        ? `the ${finding.ruleId} finding at ${where(finding)} differs from the one a sub-agent returned in: ${fieldsThatDiffer(finding, near).join(', ')}`
        : `no sub-agent returned the ${finding.ruleId} finding at ${where(finding)}, and it is not an obligation finding for a worklist site`,
    });
  }

  return {
    failures,
    tightenedBy: TIGHTENING_FACTS.filter((fact) => tightenedBy.has(fact)),
  };
};
