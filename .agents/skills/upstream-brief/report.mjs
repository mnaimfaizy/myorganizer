/**
 * The structured Upstream Brief report contract (ADR 0084 item 3 and item 10).
 *
 * A research worker writes a report matching `INPUT SHAPE` below. This module
 * turns it into a **normalized report**: the same envelope, with every entry
 * the contract could not accept moved into an `unverified` list carrying a
 * named reason, plus the counts a reader needs. That asymmetry is the whole
 * decision — a code review computes a verdict that one bad finding corrupts,
 * so it rejects the report whole; a brief has no verdict, and losing an
 * Ecosystem's good findings to one bad citation costs more than listing the
 * bad one (ADR 0084, Considered Options).
 *
 * `unverified` and `counts` are computed, never written. A report arriving
 * with either is rejected, for the same reason the code-review contract
 * rejects a hand-written verdict: a derived field the author can forge is not
 * derived.
 *
 * WHY THIS FILE IS HERE, AND NOT IN tools/scripts/
 *   The skill is portable (ADR 0018, retained by ADR 0084). A validator living
 *   in this repo's script tree would make a brief checkable only in this repo.
 *   So this module imports **nothing at all** — not a dependency, not even a
 *   Node built-in — and `validate-report.mjs` beside it is the only part that
 *   touches a filesystem or a git binary. `.agents/skills/upstream-brief/report.test.mjs`
 *   asserts that import-freedom, because "dependency-free" is the kind of
 *   claim that rots the first time somebody reaches for a helper.
 *
 * WHY LOCAL EVIDENCE IS CHECKED AT ALL
 *   The three briefs written under ADR 0018 cited `file:line` with no commit,
 *   inside a document frozen at its date, and carried two Correction blocks
 *   for three wrong claims. A quotation nothing compares to anything is a
 *   claim, not evidence (ADR 0078). Every local citation here carries the
 *   file, the line, and the literal text at that line, and every one of them
 *   is read back out of the tree at the commit the report records — which is
 *   also what lets a frozen brief stay valid after the tree moves on.
 *
 *   The four failure reasons mirror the review pipeline's
 *   (`tools/scripts/review/obligations.mjs`) deliberately and **by copying the
 *   rule rather than the code**: a reader who knows one vocabulary knows both,
 *   and the skill stays portable. The duplication is the price of that, and it
 *   is written down here so the next person does not "fix" it with an import.
 *
 * INPUT SHAPE
 *   report              schemaVersion, date, commit, ecosystems[], scanned[],
 *                       failedHops[], delta?
 *   ecosystem           lead, members[], baseline, horizon?, driftNotes[],
 *                       findings[], checkedAndClear[], opportunities[],
 *                       incidental[]
 *   upstreamFinding     type, urgency, claim, evidence, source{url, quote,
 *                       pageVersion}, local[{file,line,text}], executed?{command,
 *                       exitCode}, disposition
 *   checkedAndClear     claim, source{url, quote, pageVersion},
 *                       local[{file,line,text}], holdsFor
 *   upstreamOpportunity technique, source{url, pageVersion}, benefitQuote,
 *                       minVersion?, local[{file,line,text}]
 *   incidentalObservation summary, local[{file,line,text}], owner
 *
 *   An Opportunity spells its verbatim quote `benefitQuote` rather than
 *   `source.quote` because ADR 0084 item 8 makes that quote the benefit
 *   itself — "its benefit is the upstream's quoted statement, never an
 *   estimate". It is checked exactly like any other source quote.
 *
 * WHAT THIS MODULE DOES NOT DO
 *   The domain rules are a separate slice: the Evidence/urgency interplay
 *   (ADR 0084 item 5 — `broken-now` requires `executed` Evidence or is
 *   downgraded), the three-Opportunity-per-Ecosystem limit (item 8), and the
 *   ledger carry-forward (item 11) are not enforced here. This file is the
 *   report-level contract only: required fields, citation checking,
 *   Unverified, and the counts.
 */

// ── Vocabularies ────────────────────────────────────────────────────────────
// Every one of these is closed. A value outside its list moves the entry that
// carried it to Unverified rather than being passed through as prose, because
// the renderer groups on them and a stray value would render as a heading
// nobody declared.

export const UPSTREAM_REPORT_SCHEMA_VERSION = 1;

/** ADR 0084 retains ADR 0018's three finding types unchanged. */
export const UPSTREAM_FINDING_TYPES = /** @type {const} */ ([
  'future-risk',
  'mismatch',
  'missed-improvement',
]);

/** ADR 0084 item 5. Ordered most urgent first: this list orders the plan. */
export const UPSTREAM_URGENCIES = /** @type {const} */ ([
  'broken-now',
  'removal-scheduled',
  'deprecated',
  'advisory',
]);

/**
 * ADR 0084 item 3. `absent` is the kind this brief adds to the review
 * pipeline's three: the documents matching the Baseline were read and do not
 * say it, which on its own never proves the repo wrong.
 */
export const UPSTREAM_EVIDENCE_KINDS = /** @type {const} */ ([
  'executed',
  'cited',
  'inferred',
  'absent',
]);

/** ADR 0084 item 7 and item 9: the plan touches instructions; the rest is follow-on. */
export const UPSTREAM_DISPOSITIONS = /** @type {const} */ ([
  'plan',
  'follow-on',
]);

/** ADR 0084 item 7 names the three owners an Incidental Observation routes to. */
export const INCIDENTAL_OWNERS = /** @type {const} */ ([
  'DepAudit',
  'Audit',
  'ad-hoc-issue',
]);

/**
 * Why a local citation did not hold. Same four names the review pipeline
 * uses, by the rule above — one vocabulary, two implementations.
 */
export const CITATION_FAILURE_REASONS = /** @type {const} */ ([
  'file-not-found',
  'line-out-of-range',
  'text-differs',
  'quotes-nothing',
]);

/**
 * Why an entry is Unverified. The first three are ADR 0084 item 3's own list —
 * a URL, a verbatim quote, and the version the page states — and `malformed`
 * covers everything the shape itself refuses.
 */
export const UNVERIFIED_REASONS = /** @type {const} */ ([
  'missing-source-url',
  'missing-source-quote',
  'missing-page-version',
  'malformed',
  ...CITATION_FAILURE_REASONS,
]);

/** The four entry kinds an Ecosystem carries, and the field each hangs off. */
export const ENTRY_KINDS = /** @type {const} */ ([
  'upstreamFinding',
  'checkedAndClear',
  'upstreamOpportunity',
  'incidentalObservation',
]);

/**
 * Pinned tables. Each covers every member of its enum and is asserted at
 * module load, so a new urgency or entry kind cannot reach a reader as
 * `undefined` (AGENTS.md: a fan-out over a domain enum reaches a pinned
 * table). `enum:fanout:check` parses TypeScript and never sees this file,
 * which is exactly why the assertion is written out by hand.
 */
export const URGENCY_TITLES = {
  'broken-now': 'Broken now',
  'removal-scheduled': 'Removal scheduled',
  deprecated: 'Deprecated',
  advisory: 'Advisory',
};

export const ENTRY_LIST_FIELDS = {
  upstreamFinding: 'findings',
  checkedAndClear: 'checkedAndClear',
  upstreamOpportunity: 'opportunities',
  incidentalObservation: 'incidental',
};

for (const [members, table, name] of [
  [UPSTREAM_URGENCIES, URGENCY_TITLES, 'URGENCY_TITLES'],
  [ENTRY_KINDS, ENTRY_LIST_FIELDS, 'ENTRY_LIST_FIELDS'],
]) {
  for (const member of members) {
    if (!(member in table)) throw new Error(`${name} is missing "${member}"`);
  }
}

/** A git SHA as a report records it: abbreviated is fine, invented is not. */
const SHA = /^[0-9a-f]{7,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Thrown when the report itself cannot be read as a report — a bad envelope,
 * a missing ecosystem list, a derived field written by hand. The CLI turns
 * this into exit 1. Nothing at entry level throws: an entry that fails goes
 * to Unverified and the rest of the report stands.
 */
export class UpstreamReportRejected extends Error {
  constructor(problems) {
    super(`upstream report rejected:\n  ${problems.join('\n  ')}`);
    this.name = 'UpstreamReportRejected';
    this.problems = problems;
  }
}

// ── Small predicates ────────────────────────────────────────────────────────

const isObject = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextArray = (v) => Array.isArray(v) && v.every(isText);

/**
 * Whitespace is presentation. A line a worker copied out of a file carries
 * whatever indentation it had, so comparing on collapsed whitespace means a
 * re-indented quote is the same quote and a different quote is not.
 */
const collapse = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * The lines of a file a `file:line` citation can name. A file ending in a
 * newline splits to a trailing empty element that is not a line anybody can
 * cite; dropping it keeps the reported line count honest. CRLF is normalized
 * first so a line number means the same thing on every platform.
 */
const citableLines = (content) => {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
};

// ── Local evidence ──────────────────────────────────────────────────────────

/**
 * Compare one local citation against the tree at the report's recorded commit.
 *
 * @param {{file: string, line: number, text: string}} citation
 * @param {(file: string) => string|null|undefined} readSource
 *   file contents at the recorded commit, or null when the file is not there.
 *   Injected rather than imported: this module reads nothing, and a caller
 *   that wants to check a brief against a worktree, a tarball, or a fixture
 *   map is doing the same job as one that shells out to `git show`.
 * @returns {{ok: true} | {ok: false, reason: string, actual?: string, lineCount?: number}}
 */
export function verifyLocalEvidence(citation, readSource) {
  // A quotation with no content in it is not a quotation. Whitespace is
  // presentation everywhere else in this comparison, which is what makes
  // `text: " "` the cheapest possible forgery: it would otherwise match every
  // blank line in the tree without the writer having read anything.
  if (collapse(citation.text) === '')
    return { ok: false, reason: 'quotes-nothing' };
  const source = readSource(citation.file);
  if (source === null || source === undefined)
    return { ok: false, reason: 'file-not-found' };
  const lines = citableLines(source);
  if (
    !Number.isInteger(citation.line) ||
    citation.line < 1 ||
    citation.line > lines.length
  )
    return { ok: false, reason: 'line-out-of-range', lineCount: lines.length };
  const actual = lines[citation.line - 1];
  if (collapse(actual) !== collapse(citation.text))
    return {
      ok: false,
      reason: 'text-differs',
      actual: actual.trim().slice(0, MAX_QUOTED_SOURCE),
    };
  return { ok: true };
}

/** How much of a mismatching line is quoted back in the failure message. */
export const MAX_QUOTED_SOURCE = 200;

// ── Entry validation ────────────────────────────────────────────────────────

/**
 * One rejection. `where` is the JSON path into the input, so a reader can find
 * the entry without counting brackets; `label` is the entry's own sentence,
 * so the rendered Unverified list says what was dropped rather than only
 * where it was.
 */
const reject = (kind, ecosystem, where, reason, detail, label) => ({
  kind,
  ecosystem,
  where,
  reason,
  detail,
  label,
});

/**
 * The three facts ADR 0084 item 3 requires of any upstream citation: a URL, a
 * verbatim quote, and the version the page states. Each missing one has its
 * own reason, because "this finding is unverified" without saying which of
 * the three is absent is the kind of note a next run cannot act on.
 *
 * `quoteField` names where the verbatim text lives, which differs by entry
 * kind: an Opportunity's is `benefitQuote`, hoisted out of `source` because
 * it *is* the benefit (ADR 0084 item 8).
 */
function sourceProblems(
  entry,
  { quoteField = 'quote', quoteIn = 'source' } = {},
) {
  const problems = [];
  const source = entry?.source;
  if (!isObject(source)) {
    problems.push(['missing-source-url', 'the entry carries no source object']);
    return problems;
  }
  if (!isText(source.url))
    problems.push(['missing-source-url', 'source.url is absent or empty']);
  const quote = quoteIn === 'source' ? source[quoteField] : entry[quoteField];
  const quotePath = quoteIn === 'source' ? `source.${quoteField}` : quoteField;
  if (!isText(quote))
    problems.push([
      'missing-source-quote',
      `${quotePath} is absent or empty — a paraphrase is not a citation`,
    ]);
  if (!isText(source.pageVersion))
    problems.push([
      'missing-page-version',
      'source.pageVersion is absent or empty — a page that does not say which ' +
        'version it describes cannot be matched to a Baseline',
    ]);
  return problems;
}

/**
 * Every local citation on an entry, checked. Returns the first failure only:
 * an entry is Unverified or it is not, and listing four broken quotations for
 * one dropped finding buries the other findings' reasons.
 */
function localProblem(entry, readSource, { required }) {
  const local = entry?.local;
  if (!Array.isArray(local))
    return ['malformed', 'local must be an array of {file, line, text}'];
  if (required && local.length === 0)
    return [
      'malformed',
      'local is empty — this entry must name at least one local site',
    ];
  for (const [index, citation] of local.entries()) {
    if (
      !isObject(citation) ||
      !isText(citation.file) ||
      typeof citation.line !== 'number' ||
      typeof citation.text !== 'string'
    )
      return [
        'malformed',
        `local[${index}] is not a {file, line, text} citation`,
      ];
    const verdict = verifyLocalEvidence(citation, readSource);
    if (verdict.ok) continue;
    const at = `${citation.file}:${citation.line}`;
    switch (verdict.reason) {
      case 'quotes-nothing':
        return [
          verdict.reason,
          `local[${index}] cites ${at} and quotes nothing but whitespace`,
        ];
      case 'file-not-found':
        return [
          verdict.reason,
          `local[${index}] cites ${citation.file}, which is not in the tree at the recorded commit`,
        ];
      case 'line-out-of-range':
        return [
          verdict.reason,
          `local[${index}] cites ${at}, and that file has ${verdict.lineCount} line(s) at the recorded commit`,
        ];
      default:
        return [
          verdict.reason,
          `local[${index}] quotes ${JSON.stringify(citation.text)} at ${at}, ` +
            `where the recorded commit has ${JSON.stringify(verdict.actual)}`,
        ];
    }
  }
  return null;
}

const enumProblem = (value, members, field) =>
  members.includes(value)
    ? null
    : [
        'malformed',
        `${field} is ${JSON.stringify(value)}; expected one of ${members.join(', ')}`,
      ];

/**
 * Validate one entry of a given kind. Returns `{ok: true, entry}` or
 * `{ok: false, reason, detail, label}`. Never throws: an entry failure is a
 * demotion, not a rejection.
 */
function validateEntry(kind, raw, readSource) {
  const label = entryLabel(kind, raw);
  const fail = (reason, detail) => ({ ok: false, reason, detail, label });

  if (!isObject(raw)) return fail('malformed', 'entry is not an object');

  /** @type {[string, string]|null} */
  let problem = null;

  if (kind === 'upstreamFinding') {
    problem =
      enumProblem(raw.type, UPSTREAM_FINDING_TYPES, 'type') ??
      enumProblem(raw.urgency, UPSTREAM_URGENCIES, 'urgency') ??
      enumProblem(raw.evidence, UPSTREAM_EVIDENCE_KINDS, 'evidence') ??
      enumProblem(raw.disposition, UPSTREAM_DISPOSITIONS, 'disposition');
    if (!problem && !isText(raw.claim))
      problem = ['malformed', 'claim is absent or empty'];
    if (!problem && raw.executed !== undefined) {
      // ADR 0084 item 5: the brief records each command and its exit code.
      // The rule that such a command must write no tracked file and install
      // nothing is stated, not mechanically enforced — recording the command
      // is what makes the reader able to judge it.
      if (
        !isObject(raw.executed) ||
        !isText(raw.executed.command) ||
        !Number.isInteger(raw.executed.exitCode)
      )
        problem = ['malformed', 'executed must be {command, exitCode}'];
    }
    if (!problem) problem = sourceProblems(raw)[0] ?? null;
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  } else if (kind === 'checkedAndClear') {
    if (!isText(raw.claim)) problem = ['malformed', 'claim is absent or empty'];
    // ADR 0084 item 11 reads this range back on the next run to decide whether
    // the claim can be carried forward without new research. A claim that does
    // not say what it holds for cannot be carried forward by anything.
    if (!problem && !isText(raw.holdsFor))
      problem = ['malformed', 'holdsFor is absent or empty'];
    if (!problem) problem = sourceProblems(raw)[0] ?? null;
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  } else if (kind === 'upstreamOpportunity') {
    if (!isText(raw.technique))
      problem = ['malformed', 'technique is absent or empty'];
    if (!problem && raw.minVersion !== undefined && !isText(raw.minVersion))
      problem = ['malformed', 'minVersion, when present, is a version string'];
    if (!problem)
      problem =
        sourceProblems(raw, {
          quoteField: 'benefitQuote',
          quoteIn: 'entry',
        })[0] ?? null;
    // ADR 0084 item 8: an Opportunity "must name at least one local site,
    // checked like any local evidence". Unlike a finding, zero sites is not a
    // legal Opportunity — it would be a suggestion about nowhere.
    if (!problem) problem = localProblem(raw, readSource, { required: true });
  } else {
    problem = enumProblem(raw.owner, INCIDENTAL_OWNERS, 'owner');
    if (!problem && !isText(raw.summary))
      problem = ['malformed', 'summary is absent or empty'];
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  }

  return problem ? fail(problem[0], problem[1]) : { ok: true, entry: raw };
}

/** The entry's own sentence, for the Unverified list. */
function entryLabel(kind, raw) {
  if (!isObject(raw)) return '(unreadable entry)';
  const candidate =
    kind === 'upstreamOpportunity'
      ? raw.technique
      : kind === 'incidentalObservation'
        ? raw.summary
        : raw.claim;
  return isText(candidate) ? String(candidate).trim() : '(no claim recorded)';
}

// ── Envelope ────────────────────────────────────────────────────────────────

/**
 * Envelope problems reject the whole report. The line between these and an
 * entry demotion is "could a reader still get value out of what is left": a
 * finding with a bad quote leaves every other finding standing, while a
 * report with no commit leaves nothing checkable at all.
 */
function envelopeProblems(raw) {
  const problems = [];
  if (!isObject(raw)) return ['the report is not an object'];

  if (raw.schemaVersion !== UPSTREAM_REPORT_SCHEMA_VERSION)
    problems.push(
      `schemaVersion: expected ${UPSTREAM_REPORT_SCHEMA_VERSION}, found ${JSON.stringify(raw.schemaVersion)}`,
    );
  if (typeof raw.date !== 'string' || !ISO_DATE.test(raw.date))
    problems.push(
      `date: expected YYYY-MM-DD, found ${JSON.stringify(raw.date)}`,
    );
  if (typeof raw.commit !== 'string' || !SHA.test(raw.commit))
    problems.push(
      `commit: expected a git SHA, found ${JSON.stringify(raw.commit)}. ` +
        'Local evidence is checked at this commit, so a report without one is ' +
        'a set of claims nothing can compare to anything (ADR 0084 item 3).',
    );
  if (!isTextArray(raw.scanned))
    problems.push(
      'scanned: expected an array of the paths or globs this run read. ' +
        '"none in scanned files" named no scanned files in every brief written ' +
        'before ADR 0084, which is what made coverage unauditable.',
    );
  if (!Array.isArray(raw.failedHops))
    problems.push('failedHops: expected an array');
  else
    raw.failedHops.forEach((hop, index) => {
      if (!isObject(hop) || !isText(hop.ecosystem) || !isText(hop.reason))
        problems.push(`failedHops[${index}]: expected {ecosystem, reason}`);
    });

  // Computed, never written. Same principle as the code-review contract's
  // rejection of a hand-written verdict: a derived field the author can forge
  // is not derived.
  for (const derived of ['unverified', 'counts'])
    if (derived in raw)
      problems.push(
        `${derived} is computed by the validator and must not appear in a report`,
      );

  if (raw.delta !== undefined) {
    const d = raw.delta;
    if (
      !isObject(d) ||
      !isTextArray(d.newFindings) ||
      !isTextArray(d.resolved) ||
      !isTextArray(d.stillPresent)
    )
      problems.push(
        'delta, when present, is {newFindings, resolved, stillPresent}, each an array of strings',
      );
  }

  if (!Array.isArray(raw.ecosystems) || raw.ecosystems.length === 0)
    problems.push('ecosystems: expected a non-empty array');
  else
    raw.ecosystems.forEach((eco, index) => {
      const at = `ecosystems[${index}]`;
      if (!isObject(eco)) {
        problems.push(`${at}: not an object`);
        return;
      }
      if (!isText(eco.lead)) problems.push(`${at}.lead: absent or empty`);
      if (!isTextArray(eco.members) || eco.members.length === 0)
        problems.push(
          `${at}.members: expected a non-empty array of package names`,
        );
      // ADR 0084 item 1. The Baseline is the version actually installed; a
      // report that cannot say what it was anchored to is anchored to nothing.
      if (!isText(eco.baseline))
        problems.push(`${at}.baseline: absent or empty`);
      if (eco.horizon !== undefined && !isText(eco.horizon))
        problems.push(`${at}.horizon, when present, is a version string`);
      if (!isTextArray(eco.driftNotes))
        problems.push(`${at}.driftNotes: expected an array of strings`);
      for (const kind of ENTRY_KINDS) {
        const field = ENTRY_LIST_FIELDS[kind];
        if (!Array.isArray(eco[field]))
          problems.push(`${at}.${field}: expected an array`);
      }
    });

  return problems;
}

// ── The two entry points ────────────────────────────────────────────────────

/**
 * Validate a report as a worker wrote it and return the normalized report.
 *
 * @param {unknown} raw the input report
 * @param {{readSource: (file: string) => string|null|undefined}} options
 *   `readSource` returns a file's contents at the report's recorded commit.
 *   It is required rather than defaulted: a default that returned `null`
 *   would report every citation as `file-not-found`, which reads as the
 *   worker inventing files when in fact nobody supplied a reader.
 * @throws {UpstreamReportRejected} when the envelope is not a report
 * @returns the normalized report: envelope, surviving entries, `unverified`,
 *   and `counts`
 */
export function normalizeUpstreamReport(raw, { readSource } = {}) {
  if (typeof readSource !== 'function')
    throw new TypeError(
      'normalizeUpstreamReport needs a readSource(file) reader for the recorded commit',
    );

  const problems = envelopeProblems(raw);
  if (problems.length) throw new UpstreamReportRejected(problems);

  const unverified = [];
  // Keyed off the one pinned table rather than a second hand-written list of
  // the same four kinds. A count is a fan-out over ENTRY_KINDS like any other,
  // and the duplicate map was the shape AGENTS.md names: it would have gone on
  // compiling while silently counting three of four (ADR 0053).
  const counts = Object.fromEntries(
    ENTRY_KINDS.map((kind) => [ENTRY_LIST_FIELDS[kind], 0]),
  );

  const ecosystems = raw.ecosystems.map((eco, ecoIndex) => {
    const kept = {};
    for (const kind of ENTRY_KINDS) {
      const field = ENTRY_LIST_FIELDS[kind];
      kept[field] = [];
      eco[field].forEach((entry, entryIndex) => {
        const verdict = validateEntry(kind, entry, readSource);
        if (verdict.ok) {
          kept[field].push(entry);
          counts[field] += 1;
          return;
        }
        unverified.push(
          reject(
            kind,
            eco.lead,
            `ecosystems[${ecoIndex}].${field}[${entryIndex}]`,
            verdict.reason,
            verdict.detail,
            verdict.label,
          ),
        );
      });
    }
    return {
      lead: eco.lead,
      members: [...eco.members],
      ...(eco.horizon === undefined ? {} : { horizon: eco.horizon }),
      baseline: eco.baseline,
      driftNotes: [...eco.driftNotes],
      ...kept,
    };
  });

  return {
    schemaVersion: raw.schemaVersion,
    date: raw.date,
    commit: raw.commit,
    ...(raw.delta === undefined ? {} : { delta: raw.delta }),
    ecosystems,
    scanned: [...raw.scanned],
    failedHops: raw.failedHops.map((hop) => ({
      ecosystem: hop.ecosystem,
      reason: hop.reason,
    })),
    unverified,
    counts: { ...counts, unverified: unverified.length },
  };
}

/**
 * Re-check a **normalized** report that is already committed (ADR 0084 item 10).
 *
 * The committed artifact is the validator's output, not the worker's input:
 * it carries the write-time `unverified` list, which is a record of what was
 * dropped and is never re-checked — those entries hold no surviving claims,
 * so re-checking them would fail forever by construction.
 *
 * What is re-checked is everything that survived. Every one of those entries
 * passed its citation check at the recorded commit when the brief was
 * written, and that commit does not change. So a fresh failure is not a
 * worker's mistake — it is the report and the history disagreeing, which is
 * exactly the drift a Wired Gate exists to catch.
 *
 * @param {unknown} normalized a report read back off disk
 * @param {{readSource: (file: string) => string|null|undefined}} options
 * @returns {{ok: boolean, problems: string[], report?: object}}
 */
export function recheckUpstreamReport(normalized, { readSource } = {}) {
  if (!isObject(normalized))
    return { ok: false, problems: ['the report is not an object'] };
  if (!Array.isArray(normalized.unverified) || !isObject(normalized.counts))
    return {
      ok: false,
      problems: [
        'not a normalized report: `unverified` and `counts` are written by ' +
          '`validate-report.mjs --out`, and a report committed without them ' +
          'was never validated',
      ],
    };

  const { unverified, counts, ...input } = normalized;

  let fresh;
  try {
    fresh = normalizeUpstreamReport(input, { readSource });
  } catch (error) {
    if (!(error instanceof UpstreamReportRejected)) throw error;
    return { ok: false, problems: error.problems };
  }

  const problems = fresh.unverified.map(
    (u) =>
      `${u.where} (${u.kind} in ${u.ecosystem}) no longer holds at commit ` +
      `${normalized.commit}: ${u.reason} — ${u.detail}`,
  );

  // Same pinned table as the counter itself: a fifth entry kind must not be
  // able to arrive uncompared, which is precisely what a hand-written list of
  // four here would have allowed.
  for (const kind of ENTRY_KINDS) {
    const field = ENTRY_LIST_FIELDS[kind];
    if (counts[field] !== fresh.counts[field])
      problems.push(
        `counts.${field} records ${counts[field]} but the report carries ${fresh.counts[field]}`,
      );
  }
  if (counts.unverified !== unverified.length)
    problems.push(
      `counts.unverified records ${counts.unverified} but the unverified list has ${unverified.length}`,
    );

  return { ok: problems.length === 0, problems, report: fresh };
}
