/**
 * The golden replay results record (issue #932): one JSON line per case run,
 * including voids, which are recorded as voids and never as misses or
 * catches (ADR 0101). Every replay run appends a line for every case it
 * ran; the ledger's Runs table is generated from the accumulated lines by
 * `renderRunsTable`, and `check-review-golden-results.mjs` fails when the
 * two disagree.
 *
 * Everything here is pure except `appendResultLine`, which is the one write
 * the workflow needs; `record-golden-result.mjs` is its thin CLI.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class GoldenResultError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GoldenResultError';
  }
}

/**
 * A pattern case's run either caught the expected findings, missed them, or
 * measured nothing (ADR 0101). A clean case (issue #933) has no findings to
 * catch or miss — it passed or failed on whether a Blocking finding
 * appeared — so it is recorded as `clean-pass` or `clean-fail`, never folded
 * into `caught`/`missed`: those two carry a recall number and a clean case
 * has none, which is the whole distinction `scoreCase` in golden.mjs draws
 * and this record exists to preserve, not collapse, on the way to disk.
 */
export const OUTCOMES = Object.freeze([
  'caught',
  'missed',
  'clean-pass',
  'clean-fail',
  'void',
]);

/** The two clean-case outcomes: scored, but never carrying a recall number. */
const CLEAN_OUTCOMES = Object.freeze(['clean-pass', 'clean-fail']);

/**
 * Every reason a case run can measure nothing, matched to what
 * `.github/actions/code-reviewer/action.yml` and `review-golden-replay.yml`
 * already distinguish: the subscription rate limit (including a transcript
 * that could not be read for rate-limit events — `unknown` is not read as
 * "no lockout"), the turn ceiling on a genuinely hard case, the turn
 * ceiling because the allowlist refused a permission the reviewer's own
 * instructions told it to use (`prevented`), the obligation answer sheet
 * failing `review:obligations:check` (ADR 0101), and a residual `unknown`
 * for a run that produced no valid report for a reason none of the above
 * names.
 */
export const VOID_REASONS = Object.freeze([
  'rate-limit',
  'turn-ceiling',
  'prevented',
  'answer-sheet-check-failed',
  'unknown',
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isFiniteNonNegative = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * Validates and normalizes one result record. Throws `GoldenResultError` on
 * anything that would let a void be read back as a miss or a catch, or that
 * otherwise does not fit the schema.
 *
 * @returns the record with fixed key order, ready for `formatResultLine`.
 */
export function buildResultRecord({
  date,
  runId,
  commit,
  caseId,
  outcome,
  voidReason = null,
  recall = null,
  totalCostUsd = null,
  turns = null,
  model,
} = {}) {
  const err = (msg) => {
    throw new GoldenResultError(msg);
  };

  if (!DATE.test(date ?? ''))
    err(`date must be YYYY-MM-DD, got ${JSON.stringify(date)}`);
  if (!isNonEmptyString(runId)) err('run_id is required');
  if (!isNonEmptyString(commit)) err('commit is required');
  if (!isNonEmptyString(caseId)) err('case is required');
  if (!isNonEmptyString(model)) err('model is required');
  if (!OUTCOMES.includes(outcome))
    err(
      `outcome must be one of ${OUTCOMES.join(', ')}, got ${JSON.stringify(outcome)}`,
    );

  if (outcome === 'void') {
    if (!VOID_REASONS.includes(voidReason))
      err(
        `a void record's void_reason must be one of ${VOID_REASONS.join(', ')}, got ${JSON.stringify(voidReason)}`,
      );
    if (recall !== null)
      err(
        'a void record carries no recall — it was not scored (ADR 0101), never as a miss or a catch',
      );
  } else if (CLEAN_OUTCOMES.includes(outcome)) {
    // clean-pass / clean-fail: scored, but on whether a Blocking finding
    // appeared, not on a recall fraction — there is nothing here to recall.
    if (voidReason !== null) err(`a ${outcome} record carries no void_reason`);
    if (recall !== null)
      err(
        `a ${outcome} record carries no recall — a clean case is scored clean-pass or clean-fail, never a recall number`,
      );
  } else {
    if (voidReason !== null) err(`a ${outcome} record carries no void_reason`);
    if (
      typeof recall !== 'number' ||
      !Number.isFinite(recall) ||
      recall < 0 ||
      recall > 1
    )
      err(
        `a ${outcome} record's recall must be a number between 0 and 1, got ${JSON.stringify(recall)}`,
      );
  }

  for (const [key, value] of [
    ['total_cost_usd', totalCostUsd],
    ['turns', turns],
  ]) {
    if (value !== null && !isFiniteNonNegative(value))
      err(
        `${key} must be a non-negative number or null, got ${JSON.stringify(value)}`,
      );
  }

  return {
    date,
    run_id: runId,
    commit,
    case: caseId,
    outcome,
    void_reason: voidReason,
    recall,
    total_cost_usd: totalCostUsd,
    turns,
    model,
  };
}

/** One JSON line, in the record's fixed key order. */
export const formatResultLine = (record) => JSON.stringify(record);

/**
 * Parses the results record: one JSON object per non-blank line, each
 * re-validated through `buildResultRecord` so a hand-edited or corrupted
 * line is caught here rather than by whatever reads the parsed records.
 * Throws `GoldenResultError` naming the offending line.
 */
export function parseResultsFile(text) {
  const records = [];
  const lines = (text ?? '').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new GoldenResultError(
        `line ${i + 1}: not valid JSON: ${err.message}`,
      );
    }

    try {
      records.push(
        buildResultRecord({
          date: parsed.date,
          runId: parsed.run_id,
          commit: parsed.commit,
          caseId: parsed.case,
          outcome: parsed.outcome,
          voidReason: parsed.void_reason ?? null,
          recall: parsed.recall ?? null,
          totalCostUsd: parsed.total_cost_usd ?? null,
          turns: parsed.turns ?? null,
          model: parsed.model,
        }),
      );
    } catch (err) {
      if (err instanceof GoldenResultError)
        throw new GoldenResultError(`line ${i + 1}: ${err.message}`);
      throw err;
    }
  }
  return records;
}

/**
 * Builds, validates, and appends one line to the results record at `path`,
 * creating its directory if needed. The one write in this module; every
 * other export is pure.
 */
export function appendResultLine(path, fields) {
  const record = buildResultRecord(fields);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${formatResultLine(record)}\n`);
  return record;
}

/**
 * Groups records by `run_id` — one replay dispatch, in the order each run
 * id first appears in the file. A run's records must agree on date, model,
 * and commit; disagreement means the file was hand-edited into something
 * that never actually ran, which is a fact worth failing on rather than
 * silently picking the first value seen.
 */
export function groupRuns(records) {
  const order = [];
  const byRun = new Map();

  for (const r of records) {
    let group = byRun.get(r.run_id);
    if (!group) {
      group = {
        runId: r.run_id,
        date: r.date,
        model: r.model,
        commit: r.commit,
        records: [],
      };
      byRun.set(r.run_id, group);
      order.push(r.run_id);
    }
    for (const [field, value, seen] of [
      ['date', r.date, group.date],
      ['model', r.model, group.model],
      ['commit', r.commit, group.commit],
    ]) {
      if (value !== seen)
        throw new GoldenResultError(
          `run ${r.run_id} has records with different ${field} values (${JSON.stringify(seen)} and ${JSON.stringify(value)}) — the record is corrupt`,
        );
    }
    group.records.push(r);
  }

  return order.map((id) => byRun.get(id));
}

/**
 * Counts and the `X of Y` phrasing the ledger's narrative sections already
 * use. A clean-pass counts alongside a caught pattern case and a clean-fail
 * alongside a missed one: both pairs are "the reviewer got this one right"
 * and "the reviewer got this one wrong" for the run-level tally, even though
 * `buildResultRecord` never lets the two carry the same shape of evidence
 * (one a recall number, the other none) — collapsing them here would lose
 * nothing the raw `outcome` field on each record does not still say.
 */
export function summarizeRun(group) {
  const caught = group.records.filter(
    (r) => r.outcome === 'caught' || r.outcome === 'clean-pass',
  ).length;
  const missed = group.records.filter(
    (r) => r.outcome === 'missed' || r.outcome === 'clean-fail',
  ).length;
  const voided = group.records.filter((r) => r.outcome === 'void').length;
  const scorable = caught + missed;
  const result =
    voided === 0
      ? `${caught} of ${scorable}`
      : `${caught} of ${scorable} scorable, ${voided} void`;
  return {
    caught,
    missed,
    voided,
    scorable,
    total: group.records.length,
    result,
  };
}

/** The markers `docs/review/golden-replay-results.md` wraps the generated
 * Runs section in. Historical rows above them are hand-written and untouched
 * — the generated section starts from the first recorded line. */
export const GENERATED_START = '<!-- GENERATED:golden-runs:START -->';
export const GENERATED_END = '<!-- GENERATED:golden-runs:END -->';

/** Renders the generated Runs section from `records` — one row per replay
 * dispatch (grouped by `run_id`), newest last, matching the historical
 * table's own convention. */
export function renderRunsTable(records) {
  const groups = groupRuns(records);
  if (groups.length === 0) return '_No recorded runs yet._';

  const header =
    '| Date | Run ID | Model | Cases | Result | Commit |\n' +
    '| --- | --- | --- | --- | --- | --- |';
  const rows = groups.map((g) => {
    const s = summarizeRun(g);
    return `| ${g.date} | \`${g.runId}\` | \`${g.model}\` | ${s.total} | ${s.result} | \`${g.commit.slice(0, 7)}\` |`;
  });
  return [header, ...rows].join('\n');
}
