/**
 * The finding contract for `/code-review` (ADR 0071).
 *
 * A reviewer emits a report that matches `ReportInputSchema`. The validator
 * (`validate-review-report.mjs`) turns it into a `NormalizedReport`: every
 * finding gains a derived `id`, the envelope gains a computed `verdict` and an
 * `effectiveTier`. Neither may appear in the input — a report that arrives
 * carrying its own verdict is rejected, because a verdict is computed, never
 * written.
 *
 * The exported constants are the names the House Explainer Page manifest
 * (`docs/review/finding-lifecycle.html`) asserts against through
 * `tools/scripts/check-review-pages.mjs`. Rename here and that gate fails,
 * which is the point.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

import { RULES_DISPLAY_PATH, ruleById, ruleIds } from './rules.mjs';

/**
 * Bumped to 2 when `rule` left the identity tuple (issue #718), and to 3 when
 * the bounded `ruleId` replaced `source` in it (issue #724). The version is
 * what tells a run whether the stored artifact from the previous run is
 * comparable: identities minted at 2 mean nothing at 3, so the renderer says
 * there is no comparable previous run instead of announcing every finding new
 * and every prior finding resolved.
 */
export const REPORT_SCHEMA_VERSION = 3;

export const REVIEW_TIER_LABELS = /** @type {const} */ ([
  'review:auto',
  'review:agent',
  'review:human',
]);
export const GATE_TIER_LABELS = /** @type {const} */ ([
  'gate:mechanical',
  'gate:standard',
  'gate:full',
]);
export const FINDING_SEVERITIES = /** @type {const} */ ([
  'blocking',
  'should-fix',
  'nit',
]);
export const FINDING_EVIDENCE_KINDS = /** @type {const} */ ([
  'executed',
  'cited',
  'inferred',
]);
export const FINDING_AXES = /** @type {const} */ (['standards', 'spec']);
export const VERDICT_VALUES = /** @type {const} */ ([
  'request-changes',
  'comment',
  'approve',
]);
/**
 * What a finding is, for the purpose of recognising it again on the next run.
 * Every field is a closed vocabulary or a path the reviewer copies; nothing
 * here is prose it composes.
 *
 * `rule` is deliberately absent: it is free-form text the model rewrites every
 * run, and a single Unicode arrow degrading to ASCII minted a new identity.
 * The published record showed a persisting count of zero in 38 of 38
 * consecutive reports across four Pull Requests — no identity ever survived a
 * push, so a declined finding was announced as resolved and its thread closed
 * (issue #718).
 *
 * `source` is absent too, and `ruleId` stands where it stood (issue #724). A
 * source discriminates far too coarsely to be an identity on its own: one of
 * them, `smell-baseline`, covered all twelve Fowler smells, so two unrelated
 * smells in one file were one finding as far as the strip was concerned.
 */
export const FINDING_IDENTITY_FIELDS = /** @type {const} */ ([
  'axis',
  'ruleId',
  'file',
]);
export const CONFIDENCE_VALUES = /** @type {const} */ ([
  'high',
  'medium',
  'low',
]);
export const SPEC_KINDS = /** @type {const} */ (['issue', 'path', 'none']);
export const SPEC_FOUND_BY = /** @type {const} */ ([
  'branch',
  'commits',
  'argument',
  'user',
  'none',
]);

/**
 * The `source` a Fowler smell-baseline finding carries. The baseline is
 * always a judgement call, so the validator caps it at should-fix even when
 * the reviewer cites something (ADR 0071 item 1).
 *
 * Since issue #724 the cap is primarily the catalogue's: every `smell-*` rule
 * declares `maxSeverity`, and that is what a finding is checked against. This
 * stays because `source` is still what the reviewer writes and what the golden
 * set matches on, so a finding marked smell-baseline under some other rule id
 * is capped by the same principle rather than slipping between the two.
 */
export const SMELL_BASELINE_SOURCE = 'smell-baseline';

/**
 * Pinned display tables. Each covers every member of its enum and is asserted
 * at module load, so a new axis or verdict cannot render as `undefined`
 * (AGENTS.md, fan-out over a domain enum).
 */
export const AXIS_TITLES =
  /** @type {Record<typeof FINDING_AXES[number], string>} */ ({
    standards: 'Standards',
    spec: 'Spec',
  });
// Not exported: `verdictHeading` below is the only way this table reaches a
// caller. An exported title table invites a second spelling of the heading
// somewhere else, which is the drift the helper exists to prevent.
const VERDICT_TITLES =
  /** @type {Record<typeof VERDICT_VALUES[number], string>} */ ({
    'request-changes': 'Request changes',
    comment: 'Comment',
    approve: 'Approve',
  });
for (const [members, table, name] of [
  [FINDING_AXES, AXIS_TITLES, 'AXIS_TITLES'],
  [VERDICT_VALUES, VERDICT_TITLES, 'VERDICT_TITLES'],
]) {
  for (const m of members) {
    if (!(m in table)) throw new Error(`${name} is missing "${m}"`);
  }
}

/**
 * The heading a rendered report carries. It is a contract rather than a
 * layout choice: the escaped-defect measurement reads a merged Pull
 * Request's verdict back out of its published summary comment, so the
 * renderer that writes this line and the parser that reads it must not each
 * carry their own spelling of it (`escaped-defects.mjs`).
 */
export const verdictHeading = (verdict) =>
  `# Code review — ${VERDICT_TITLES[verdict]}`;

/** Cap on quoted issue text: enough for one requirement, not a body. */
export const SPEC_QUOTE_MAX_CHARS = 400;
/** Cap on an executed command's output excerpt carried in the report. */
export const EXECUTED_OUTPUT_MAX_CHARS = 2000;

const nonEmpty = z.string().trim().min(1);
const sha = z.string().regex(/^[0-9a-f]{7,40}$/, 'expected a git SHA');

export const LocationSchema = z.strictObject({
  file: nonEmpty,
  startLine: z.int().positive(),
  endLine: z.int().positive().optional(),
  headSha: sha,
});

const ExecutedEvidence = z.strictObject({
  kind: z.literal('executed'),
  command: nonEmpty,
  exitCode: z.int(),
  outputExcerpt: z.string().max(EXECUTED_OUTPUT_MAX_CHARS),
  cwd: nonEmpty,
});

/**
 * `sourceKind: 'standard'` quotes repo-authored text and is trusted.
 * `sourceKind: 'spec'` quotes an issue or a spec file, which is authored
 * outside the repo's review path; it is capped and must be marked untrusted.
 */
const CitedEvidence = z.strictObject({
  kind: z.literal('cited'),
  sourceKind: z.enum(['standard', 'spec']),
  quote: z.string().trim().min(1).max(SPEC_QUOTE_MAX_CHARS),
  untrusted: z.boolean(),
});

const InferredEvidence = z.strictObject({
  kind: z.literal('inferred'),
  reasoning: nonEmpty,
});

export const EvidenceSchema = z.discriminatedUnion('kind', [
  ExecutedEvidence,
  CitedEvidence,
  InferredEvidence,
]);

/**
 * `ruleId` is the identity half of a finding: one id from the bounded
 * catalogue (`tools/scripts/review/rules.mjs`). `source` names where the rule
 * lives — the standard's path, the issue reference, `smell-baseline` — and
 * `rule` states the requirement in the source's own words; `summary` is the
 * human claim. Those three are display. They are read by people and by the
 * golden scorer's regexes, and by nothing that decides an identity, a
 * severity, or a verdict. Nothing here carries diff text (ADR 0071 item 3).
 */
/** Which citation source each axis may rest on (pinned; asserted below). */
export const AXIS_CITATION_SOURCE = /** @type {const} */ ({
  standards: 'standard',
  spec: 'spec',
});
for (const axis of FINDING_AXES)
  if (!AXIS_CITATION_SOURCE[axis])
    throw new Error(`AXIS_CITATION_SOURCE lacks ${axis}`);

export const FindingInputSchema = z
  .strictObject({
    axis: z.enum(FINDING_AXES),
    severity: z.enum(FINDING_SEVERITIES),
    summary: nonEmpty,
    ruleId: nonEmpty,
    source: nonEmpty,
    rule: nonEmpty,
    evidence: EvidenceSchema,
    location: LocationSchema.optional(),
    remedy: z.string().trim().min(1).optional(),
    confidence: z.enum(CONFIDENCE_VALUES).optional(),
    wouldBlock: z.boolean().optional(),
  })
  .superRefine((f, ctx) => {
    const issue = (message, path = []) =>
      ctx.addIssue({ code: 'custom', message, path });

    // The bounded rule (issue #724). An id outside the catalogue is rejected
    // rather than accepted as prose, because the identity tuple hashes it: an
    // id the reviewer invented is an id it would invent differently next run,
    // which is the instability the catalogue replaced.
    const rule = ruleById(f.ruleId);
    if (!rule) {
      issue(
        `"${f.ruleId}" is not one of the ${ruleIds().length} rule ids in ` +
          `${RULES_DISPLAY_PATH}; pick the closest, or the family's fallback ` +
          `when nothing fits`,
        ['ruleId'],
      );
    } else if (!rule.axes.includes(f.axis)) {
      issue(
        `"${f.ruleId}" is a ${rule.axes.join('/')} rule and this is a ${f.axis} finding`,
        ['ruleId'],
      );
    }
    if (rule?.maxSeverity) {
      const cap = SEVERITY_RANK[rule.maxSeverity];
      if (cap === undefined) {
        // A cap nobody can compare against would pass everything, silently.
        issue(
          `${RULES_DISPLAY_PATH}: ${f.ruleId} caps at "${rule.maxSeverity}", which is not a severity`,
          ['severity'],
        );
      } else if (SEVERITY_RANK[f.severity] < cap) {
        issue(
          `a ${rule.title} finding is a judgement call and caps at ${rule.maxSeverity}`,
          ['severity'],
        );
      }
    }

    if (f.evidence.kind === 'cited') {
      // A Standards finding cites a repo standard; a Spec finding cites the
      // spec. Crossing them lets untrusted issue text stand behind a
      // standards claim, or a repo file pose as the spec.
      const expected = AXIS_CITATION_SOURCE[f.axis];
      if (f.evidence.sourceKind !== expected) {
        issue(
          `a ${f.axis} finding cites ${expected} text, not ${f.evidence.sourceKind}`,
          ['evidence', 'sourceKind'],
        );
      }
      if (f.evidence.sourceKind === 'spec' && f.evidence.untrusted !== true) {
        issue(
          'a quoted spec line is authored outside the repo and must carry untrusted: true',
          ['evidence', 'untrusted'],
        );
      }
      if (f.evidence.sourceKind === 'standard' && f.evidence.untrusted) {
        issue('repo-authored standards text is not untrusted', [
          'evidence',
          'untrusted',
        ]);
      }
    }

    if (f.severity === 'blocking') {
      if (f.source === SMELL_BASELINE_SOURCE) {
        issue(
          'a smell-baseline finding is always a judgement call and caps at should-fix',
          ['severity'],
        );
      }
      if (f.evidence.kind === 'inferred') {
        issue(
          'blocking requires executed or cited evidence; an inferred finding caps at should-fix',
          ['severity'],
        );
      }
      const anchoredToSpec =
        f.evidence.kind === 'cited' && f.evidence.sourceKind === 'spec';
      if (!f.location && !anchoredToSpec) {
        issue('blocking requires a diff location or a quoted spec line', [
          'location',
        ]);
      }
    }

    if (f.wouldBlock && f.severity !== 'should-fix') {
      issue('wouldBlock is only meaningful on a should-fix finding', [
        'wouldBlock',
      ]);
    }
  });

export const SpecSourceSchema = z
  .strictObject({
    kind: z.enum(SPEC_KINDS),
    ref: nonEmpty.optional(),
    foundBy: z.enum(SPEC_FOUND_BY),
  })
  .superRefine((s, ctx) => {
    if (s.kind === 'none' && (s.ref || s.foundBy !== 'none')) {
      ctx.addIssue({
        code: 'custom',
        message: 'a spec of kind none has no ref and was found by nobody',
        path: ['kind'],
      });
    }
    if (s.kind !== 'none' && (!s.ref || s.foundBy === 'none')) {
      ctx.addIssue({
        code: 'custom',
        message: 'a located spec needs a ref and a foundBy',
        path: ['ref'],
      });
    }
  });

/**
 * The envelope as a reviewer writes it. `strictObject` is what rejects a
 * hand-written `verdict`, `effectiveTier`, or finding `id`.
 */
const envelopeFields = {
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  base: sha,
  head: sha,
  tier: z.enum(REVIEW_TIER_LABELS).nullable(),
  spec: SpecSourceSchema,
  standardsSources: z.array(nonEmpty),
  executed: z.array(nonEmpty),
  suppressed: z.strictObject({ redundant: z.int().nonnegative() }),
  model: nonEmpty,
  durationMs: z.int().nonnegative(),
  /**
   * Token spend, when the harness reports it. Optional because not every
   * harness exposes usage; the trust ratchet reads it where present and
   * falls back to model plus wall-clock.
   */
  cost: z
    .strictObject({
      inputTokens: z.int().nonnegative(),
      outputTokens: z.int().nonnegative(),
    })
    .optional(),
};

export const ReportInputSchema = z.strictObject({
  ...envelopeFields,
  findings: z.array(FindingInputSchema),
});

/**
 * What the validator writes and the only thing the renderer accepts: the
 * input plus derived ids, the computed verdict, and the effective tier.
 */
export const NormalizedReportSchema = z.strictObject({
  ...envelopeFields,
  findings: z.array(
    z
      .object({ id: z.string().regex(/^[0-9a-f]{12}$/) })
      .and(FindingInputSchema),
  ),
  verdict: z.enum(VERDICT_VALUES),
  effectiveTier: z.enum(REVIEW_TIER_LABELS).nullable(),
});

const SEVERITY_RANK = Object.fromEntries(
  FINDING_SEVERITIES.map((s, i) => [s, i]),
);

/** Sort key: blocking first, then should-fix, then nit. Stable within a rank. */
export const bySeverity = (a, b) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

/**
 * Derived identity: axis + ruleId + file. Line is excluded so a rebase does
 * not mint a new finding, and `rule` is excluded so a reworded sentence does
 * not either (ADR 0071 item 6, amended by issue #718 and issue #724). Every
 * field here is a closed vocabulary or a path the reviewer copies rather than
 * composes.
 */
const IDENTITY_ACCESSORS =
  /** @type {Record<typeof FINDING_IDENTITY_FIELDS[number], (f: object) => string>} */ ({
    axis: (f) => f.axis,
    ruleId: (f) => f.ruleId,
    file: (f) => f.location?.file ?? '',
  });

/**
 * `occurrence` is 0 for the first finding with this identity tuple in a
 * report and counts up for repeats, so two findings that share axis, ruleId,
 * and file keep distinct ids without the line entering the hash (ADR 0071
 * item 6). Repeats are numbered in startLine order, so the numbering survives
 * a rebase the same way the tuple does.
 *
 * Since issue #724 a repeat means two findings of the *same* rule in one file,
 * not — as it did while `source` stood here — two unrelated rules that happen
 * to be written down in the same document. What is left is genuinely one rule
 * applied twice, plus one residue: several unlocated spec findings of the same
 * kind all hash the empty file, and several `standard-other` findings in one
 * file do the same because the fallback is what a reviewer reaches for when it
 * cannot name the rule. Both are disambiguated by line order within the
 * report, and both cost churn — a resolve and a repost of feedback still on
 * the report — rather than the lost feedback of issue #718.
 */
export const findingId = (finding, occurrence = 0) => {
  const tuple = FINDING_IDENTITY_FIELDS.map((field) =>
    IDENTITY_ACCESSORS[field](finding),
  );
  if (occurrence > 0) tuple.push(occurrence);
  return createHash('sha256')
    .update(JSON.stringify(tuple))
    .digest('hex')
    .slice(0, 12);
};

const assignFindingIds = (findings) => {
  const byTuple = new Map();
  const order = findings
    .map((f, index) => ({ f, index }))
    .sort(
      (a, b) =>
        (a.f.location?.startLine ?? 0) - (b.f.location?.startLine ?? 0) ||
        a.index - b.index,
    );
  const ids = new Array(findings.length);
  for (const { f, index } of order) {
    const key = findingId(f);
    const occurrence = byTuple.get(key) ?? 0;
    byTuple.set(key, occurrence + 1);
    ids[index] = findingId(f, occurrence);
  }
  return findings.map((f, index) => ({ id: ids[index], ...f }));
};

/**
 * Whether a stored artifact from an earlier run can be diffed against this
 * one. Ids are only meaningful within a schema version — a report written
 * before `ruleId` replaced `source` in the tuple carries identities this run
 * can never mint — so a mismatch is "no comparable previous run", not
 * "everything resolved".
 *
 * @param {unknown} raw a report read back from an artifact, of any vintage
 */
export const isComparableReport = (raw) =>
  reportSchemaVersionOf(raw) === REPORT_SCHEMA_VERSION;

/** The version a stored artifact claims, for the message when it is not ours. */
export function reportSchemaVersionOf(raw) {
  return typeof raw === 'object' && raw !== null
    ? raw.schemaVersion
    : undefined;
}

/** Any blocking → request-changes; only nits (or nothing) → approve; else comment. */
export const computeVerdict = (findings) => {
  if (findings.some((f) => f.severity === 'blocking')) return 'request-changes';
  if (findings.every((f) => f.severity === 'nit')) return 'approve';
  return 'comment';
};

/**
 * A report with no spec source is tightened down one tier level at the
 * envelope level: auto → agent, agent → human, human → human. Interactive
 * runs (tier null) stay null: there is no label to tighten.
 */
export const computeEffectiveTier = (report) => {
  if (report.tier === null) return null;
  if (report.spec.kind === 'none') {
    const tiers = ['review:auto', 'review:agent', 'review:human'];
    const current = tiers.indexOf(report.tier);
    const next = Math.min(current + 1, tiers.length - 1);
    return tiers[next];
  }
  return report.tier;
};

/**
 * Validate a raw object and return the normalized report, or throw a ZodError.
 * This is the only path from reviewer output to anything that reads it.
 */
export const normalizeReport = (raw) => {
  const input = ReportInputSchema.parse(raw);
  const findings = assignFindingIds(input.findings);
  return {
    ...input,
    findings,
    verdict: computeVerdict(findings),
    effectiveTier: computeEffectiveTier(input),
  };
};

/** Render Zod issues as one line each, path first, for terminal and CI logs. */
export const formatIssues = (error) =>
  error.issues.map((i) => {
    const path = i.path.length ? i.path.join('.') : '(root)';
    return `${path}: ${i.message}`;
  });
