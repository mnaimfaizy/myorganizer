/**
 * What the CI review workflow posts, decided as pure functions so the
 * contract tests never touch GitHub (ADR 0070 item 8: a script posts, the
 * reviewer never holds a token). `publish-review-report.mjs` is the only
 * file that calls `gh`.
 *
 * Three decisions live here:
 *
 *   1. The summary comment. One per Pull Request, found by `STICKY_MARKER`
 *      and edited in place, so a reader sees the latest report and never a
 *      pile of stale ones.
 *   2. Inline comments. Only `blocking` findings that carry a location, one
 *      per finding id, never posted twice: the id marker in the body is what
 *      makes a re-run idempotent.
 *   3. The label. ADR 0069 item 1: a blocking finding relabels an `auto` or
 *      `agent` Pull Request to `review:human`; no spec source does the same
 *      (`effectiveTier`). The label never loosens here — only the classifier
 *      lowers a tier, and only on a fresh run.
 */

import { FINDING_AXES, REVIEW_TIER_LABELS, VERDICT_VALUES } from './schema.mjs';

export const STICKY_MARKER = '<!-- code-review-report -->';
export const findingMarker = (id) => `<!-- code-review:finding:${id} -->`;

const AXIS_WORD = /** @type {const} */ ({
  standards: 'Standards',
  spec: 'Spec',
});
for (const axis of FINDING_AXES)
  if (!AXIS_WORD[axis]) throw new Error(`AXIS_WORD lacks ${axis}`);

/**
 * The label the Pull Request should wear after this run. A blocking
 * verdict is human regardless of tier; otherwise the validator's
 * effective tier (which is the job's tier, or human when no spec was
 * found). `null` when the run carried no tier at all.
 */
export const targetTierLabel = ({ tier, effectiveTier, verdict }) => {
  if (verdict !== undefined && !VERDICT_VALUES.includes(verdict))
    throw new Error(`unknown verdict ${verdict}`);
  if (verdict === 'request-changes') return 'review:human';
  return effectiveTier ?? tier ?? null;
};

/** @param {string[]} currentLabels every label on the Pull Request */
export const planRelabel = (currentLabels, target) => {
  if (!target) return null;
  if (!REVIEW_TIER_LABELS.includes(target))
    throw new Error(`unknown tier label ${target}`);
  const current = currentLabels.filter((l) => REVIEW_TIER_LABELS.includes(l));
  const remove = current.filter((l) => l !== target);
  const add = current.includes(target) ? [] : [target];
  return add.length === 0 && remove.length === 0 ? null : { add, remove };
};

const header = ({ headSha, runUrl }) =>
  [
    STICKY_MARKER,
    `<sub>Automated code review of \`${headSha.slice(0, 7)}\` · [run](${runUrl}) · findings are JSON validated by \`tools/scripts/review/schema.mjs\`; the verdict below is computed, never written (ADR 0070).</sub>`,
    '',
  ].join('\n');

/** The sticky comment for a validated report. */
export const summaryBody = ({ rendered, headSha, runUrl }) =>
  `${header({ headSha, runUrl })}${rendered.trimEnd()}\n`;

/**
 * The sticky comment when the reviewer produced nothing usable. The Pull
 * Request goes to a human (ADR 0069 item 5); the reason is the validator's
 * output or the workflow's, never a guess.
 */
export const rejectedBody = ({ reason, headSha, runUrl }) =>
  [
    header({ headSha, runUrl }),
    '## Code review — no verdict',
    '',
    'The reviewer did not produce a report that meets the finding contract, so there is no verdict and this Pull Request is `review:human`. Nothing was downgraded to make it pass.',
    '',
    '```text',
    reason.trim().slice(0, 4000),
    '```',
    '',
  ].join('\n');

const evidenceLine = (f) => {
  const e = f.evidence;
  if (e.kind === 'executed')
    return `Executed \`${e.command}\` (exit ${e.exitCode}).`;
  if (e.kind === 'cited')
    return e.sourceKind === 'spec'
      ? 'Cited the spec (untrusted quote; see the summary comment).'
      : `Cited: ${e.quote}`;
  return `Inferred: ${e.reasoning}`;
};

/**
 * Inline comments for blocking findings with a location, skipping any id
 * already present in an existing review comment body.
 */
export const inlineComments = ({ findings, existingBodies = [] }) => {
  const seen = new Set();
  for (const body of existingBodies) {
    for (const m of body.matchAll(/<!-- code-review:finding:([0-9a-f]+) -->/g))
      seen.add(m[1]);
  }
  return findings
    .filter((f) => f.severity === 'blocking' && f.location && !seen.has(f.id))
    .map((f) => ({
      id: f.id,
      path: f.location.file,
      line: f.location.endLine ?? f.location.startLine,
      startLine:
        f.location.endLine && f.location.endLine !== f.location.startLine
          ? f.location.startLine
          : undefined,
      body: [
        findingMarker(f.id),
        `**Blocking · ${AXIS_WORD[f.axis]}** — ${f.summary}`,
        '',
        `Rule: ${f.rule} (${f.source})`,
        evidenceLine(f),
        ...(f.remedy ? ['', `Suggested: ${f.remedy}`] : []),
      ].join('\n'),
    }));
};

/**
 * Everything the poster will do, in one object, so a test can read it and
 * the CLI can only execute it.
 */
export const planPublication = ({
  normalized,
  rendered,
  rejectedReason,
  tier,
  headSha,
  runUrl,
  currentLabels,
  existingReviewBodies = [],
}) => {
  if (rejectedReason !== undefined) {
    return {
      outcome: 'rejected',
      verdict: null,
      summary: rejectedBody({ reason: rejectedReason, headSha, runUrl }),
      inline: [],
      relabel: planRelabel(currentLabels, tier ? 'review:human' : null),
      failCheck: true,
    };
  }
  const target = targetTierLabel({
    tier,
    effectiveTier: normalized.effectiveTier,
    verdict: normalized.verdict,
  });
  return {
    outcome: 'published',
    verdict: normalized.verdict,
    summary: summaryBody({ rendered, headSha, runUrl }),
    inline: inlineComments({
      findings: normalized.findings,
      existingBodies: existingReviewBodies,
    }),
    relabel: planRelabel(currentLabels, target),
    failCheck: normalized.verdict === 'request-changes',
  };
};
