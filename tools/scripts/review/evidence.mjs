/**
 * The one place a finding's evidence becomes a line of prose. The renderer
 * and the publisher both read it, so the fan-out over the evidence kinds is
 * pinned here and asserted at module load against the enum (ADR 0053); a
 * new kind cannot render as `undefined` in one place and a sentence in the
 * other.
 */
import { FINDING_EVIDENCE_KINDS } from './schema.mjs';

/**
 * A quote is one line of inline code. Newlines would let a spec author
 * start a Markdown heading, list, or fence inside the posted comment;
 * backticks would close the code span early. Both are flattened here, for
 * repo standards as well as spec text, so the rendering never depends on
 * who wrote the quote.
 */
export const inlineQuote = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/`/g, "'")
    .trim();

/** @type {Record<(typeof FINDING_EVIDENCE_KINDS)[number], (e: any) => string>} */
export const EVIDENCE_TEXT = /** @type {const} */ ({
  executed: (e) =>
    `executed \`${e.command}\` (exit ${e.exitCode}, in \`${e.cwd}\`)`,
  // Quotes are fenced as one line of inline code, never interpolated as
  // Markdown; a spec quote is additionally labelled untrusted.
  cited: (e) =>
    e.sourceKind === 'spec'
      ? `cited spec (untrusted quote): \`${inlineQuote(e.quote)}\``
      : `cited standard: \`${inlineQuote(e.quote)}\``,
  inferred: (e) => `inferred: ${inlineQuote(e.reasoning)}`,
});
for (const kind of FINDING_EVIDENCE_KINDS)
  if (typeof EVIDENCE_TEXT[kind] !== 'function')
    throw new Error(`EVIDENCE_TEXT lacks ${kind}`);

export const evidenceText = (finding) =>
  EVIDENCE_TEXT[finding.evidence.kind](finding.evidence);
