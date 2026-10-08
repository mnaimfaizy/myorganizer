/**
 * The words the run ladder speaks (issue #1031, ADR 0123 items 4 and 5).
 *
 * Kept apart from `run-ladder.mjs` so a reader that only needs the
 * vocabulary imports no package. `golden-results.mjs` is one: it validates a
 * result line's `void_reason` against `RUN_FAILURES`, and the golden
 * replay's first job reads the results record through it before any
 * dependency is installed. Importing the ladder there pulled in `zod` by
 * way of `obligations.mjs`, and replay run 37722854031 failed to list its
 * cases.
 */

/** What fails `Agent Review Ran`, and voids a golden replay (ADR 0101). */
export const RUN_FAILURES = /** @type {const} */ ([
  'brief-not-read',
  'finding-not-returned',
]);

/**
 * What tightens the effective tier. However many hold, they cost one step
 * together, on top of the separate step a missing spec costs.
 */
export const TIGHTENING_FACTS = /** @type {const} */ ([
  'index-not-opened',
  'dispatch-off-template',
  'transcript-unreadable',
  'reply-unparseable',
]);
