/**
 * The one place a finding's evidence becomes a line of prose. The renderer
 * and the publisher both read it, so the fan-out over the evidence kinds is
 * pinned here and asserted at module load against the enum (ADR 0053); a
 * new kind cannot render as `undefined` in one place and a sentence in the
 * other.
 */
import { FINDING_EVIDENCE_KINDS } from './schema.mjs';

/** @type {Record<(typeof FINDING_EVIDENCE_KINDS)[number], (e: any) => string>} */
export const EVIDENCE_TEXT = /** @type {const} */ ({
  executed: (e) =>
    `executed \`${e.command}\` (exit ${e.exitCode}, in \`${e.cwd}\`)`,
  // Spec quotes are authored outside the repo: fenced, never interpolated.
  cited: (e) =>
    e.sourceKind === 'spec'
      ? `cited spec (untrusted quote): \`${e.quote.replace(/`/g, "'")}\``
      : `cited standard: ${e.quote}`,
  inferred: (e) => `inferred: ${e.reasoning}`,
});
for (const kind of FINDING_EVIDENCE_KINDS)
  if (typeof EVIDENCE_TEXT[kind] !== 'function')
    throw new Error(`EVIDENCE_TEXT lacks ${kind}`);

export const evidenceText = (finding) =>
  EVIDENCE_TEXT[finding.evidence.kind](finding.evidence);
