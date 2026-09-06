/**
 * The finding contract for `/code-review` (ADR 0070).
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

export const REPORT_SCHEMA_VERSION = 1;

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
export const FINDING_IDENTITY_FIELDS = /** @type {const} */ ([
  'axis',
  'source',
  'rule',
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
 * the reviewer cites something (ADR 0070 item 1).
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
export const VERDICT_TITLES =
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
 * `source` and `rule` are the identity half of a finding: the standard's path
 * or the issue reference, and the rule or requirement it applies. `summary`
 * is the human claim. Nothing here carries diff text (ADR 0070 item 3).
 */
export const FindingInputSchema = z
  .strictObject({
    axis: z.enum(FINDING_AXES),
    severity: z.enum(FINDING_SEVERITIES),
    summary: nonEmpty,
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

    if (f.evidence.kind === 'cited') {
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
 * Derived identity: axis + source + rule + file, line excluded so a rebase
 * does not mint a new finding (ADR 0070 item 6).
 */
const IDENTITY_ACCESSORS =
  /** @type {Record<typeof FINDING_IDENTITY_FIELDS[number], (f: object) => string>} */ ({
    axis: (f) => f.axis,
    source: (f) => f.source,
    rule: (f) => f.rule,
    file: (f) => f.location?.file ?? '',
  });

/**
 * `occurrence` is 0 for the first finding with this identity tuple in a
 * report and counts up for repeats, so two findings that share axis,
 * source, rule, and file but differ by line keep distinct ids without the
 * line entering the hash (ADR 0070 item 6). Repeats are numbered in
 * startLine order, so the numbering survives a rebase the same way the
 * tuple does.
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

/** Any blocking → request-changes; only nits (or nothing) → approve; else comment. */
export const computeVerdict = (findings) => {
  if (findings.some((f) => f.severity === 'blocking')) return 'request-changes';
  if (findings.every((f) => f.severity === 'nit')) return 'approve';
  return 'comment';
};

/**
 * A report with no spec source is tightened to human at the envelope level.
 * Interactive runs (tier null) stay null: there is no label to tighten.
 */
export const computeEffectiveTier = (report) => {
  if (report.tier === null) return null;
  if (report.spec.kind === 'none') return 'review:human';
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
