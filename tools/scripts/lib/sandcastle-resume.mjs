/**
 * Pure decision logic for resuming an Interrupted Slice.
 *
 * Kept out of `.sandcastle/main.mts` so it can be tested without Docker, git, a
 * network, or a five-hour wait for a real provider limit. The orchestrator stays
 * orchestration; every judgement it makes about a checkpoint is decided here from
 * explicit inputs.
 *
 * Run the tests with: yarn sandcastle:resume:test
 *
 * See docs/adr/0035-interrupted-slices-resume-from-git-and-destruction-is-deliberate.md.
 * Decisions recorded there are settled — this module implements them, it does not
 * revisit them.
 */

/**
 * What the orchestrator should do with a slice branch it is about to dispatch.
 *
 * - `resume`     — a usable Slice Checkpoint is present; continue from it.
 * - `fresh`      — delete and recreate the branch from the base ref (today's behaviour).
 * - `skip-stale` — a checkpoint exists but is based on a superseded head. Report it
 *                  and leave the branch alone: rebasing is the human's call, and
 *                  deleting would destroy work the maintainer has not seen.
 */
export const SLICE_DISPOSITIONS = Object.freeze({
  resume: 'resume',
  fresh: 'fresh',
  skipStale: 'skip-stale',
});

/**
 * Decide how to treat a slice branch.
 *
 * @param {object} input
 * @param {boolean} input.branchExists          Does the slice branch exist at all?
 * @param {number}  input.commitsAhead          Commits on the branch beyond the base ref.
 * @param {boolean} input.mergeBaseMatchesBase  Is merge-base(branch, base) === base?
 * @param {boolean} [input.discardRequested]    Did the maintainer pass the discard flag?
 * @returns {'resume'|'fresh'|'skip-stale'}
 */
export function decideSliceDisposition({
  branchExists,
  commitsAhead,
  mergeBaseMatchesBase,
  discardRequested = false,
}) {
  // An explicit discard outranks everything. The maintainer has looked at the work
  // and judged it worthless; this is the only path that destroys a checkpoint.
  if (discardRequested) return SLICE_DISPOSITIONS.fresh;

  // No branch, or a branch with nothing on it, is not a checkpoint. Recreating it is
  // both correct and what happens today.
  if (!branchExists) return SLICE_DISPOSITIONS.fresh;
  if (!Number.isFinite(commitsAhead) || commitsAhead <= 0) {
    return SLICE_DISPOSITIONS.fresh;
  }

  // Slices stack: each is cut from the live feature head so it builds on every
  // integrated predecessor. A checkpoint left behind while later slices integrated is
  // based on a head that no longer exists in the feature branch's history, so it can
  // neither fast-forward nor be safely built on.
  if (!mergeBaseMatchesBase) return SLICE_DISPOSITIONS.skipStale;

  return SLICE_DISPOSITIONS.resume;
}

/**
 * The five guardrails a resumed agent is held to.
 *
 * An interrupted agent stops mid-thought, so whatever it left behind is unreviewed by
 * construction — the run died before any reviewer saw it. These exist to stop a fresh
 * agent reading that output as finished work.
 */
export const RESUME_GUARDRAILS = Object.freeze([
  'The checkpoint is a checkpoint, NOT approved work. Audit it before you extend it.',
  'Do NOT reset, rebase, or amend the checkpoint commit. It is the maintainer’s anchor for diffing what the interrupted run produced. Correct it FORWARD with normal commits.',
  'Do NOT restart from scratch and do NOT revert files wholesale. If part of the checkpoint is wrong, change it forward and say why.',
  'Report your inventory BEFORE your first edit: which acceptance criteria are met, which are partial, and which are untouched.',
  'Files present in the checkpoint do NOT satisfy a Gated Pipeline. A spec file already in the tree does not mean TestScaffold ran, was reviewed, or passed — route it through the pipelines named above regardless.',
]);

/**
 * Build the brief for a resumed slice.
 *
 * Takes the prompt the slice would normally receive and prepends the checkpoint
 * context plus the audit-first instruction. The diff itself is deliberately NOT
 * inlined: the agent can read it from git in one command, and spending the context
 * budget on it defeats the point of resuming rather than restarting.
 *
 * @param {object} input
 * @param {string}   input.basePrompt      The prompt this slice would normally get.
 * @param {number}   input.issueNumber
 * @param {string}   input.sliceBranch
 * @param {object}   input.checkpoint
 * @param {string}   input.checkpoint.sha
 * @param {string[]} [input.checkpoint.files]
 * @returns {string}
 */
export function buildResumeBrief({
  basePrompt,
  issueNumber,
  sliceBranch,
  checkpoint,
}) {
  const files = checkpoint.files ?? [];
  const inventory =
    files.length > 0
      ? files.map((file) => `  - ${file}`).join('\n')
      : '  (file list unavailable — read it with `git show --stat`)';

  return [
    `## RESUMING an interrupted attempt — read this before anything else`,
    ``,
    `A previous agent run on issue #${issueNumber} was interrupted before it signalled`,
    `completion. Its work was preserved as a Slice Checkpoint on your branch:`,
    ``,
    `  branch     ${sliceBranch}`,
    `  checkpoint ${checkpoint.sha}`,
    `  files      ${files.length || 'unknown'}`,
    ``,
    inventory,
    ``,
    `Inspect it with \`git show ${checkpoint.sha}\` and \`git show --stat ${checkpoint.sha}\`.`,
    ``,
    `### Rules for this run`,
    ``,
    ...RESUME_GUARDRAILS.map(
      (guardrail, index) => `${index + 1}. ${guardrail}`,
    ),
    ``,
    `Your FIRST output must be the inventory required by rule 4. Only then start work.`,
    ``,
    `---`,
    ``,
    basePrompt,
  ].join('\n');
}
