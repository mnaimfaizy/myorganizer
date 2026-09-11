// The spec anchor: how a branch whose NAME carries no issue number still tells
// the code review which issue it answers to.
//
// `/code-review` resolves its spec source in a fixed order — branch name, then
// an issue reference in a commit, then nothing (tools/scripts/review/
// resolve-spec.mjs). A sandcastle PRD integration branch is `feat/<prd-slug>`:
// the slug is the PRD's title, not its number, so the branch-name step cannot
// match and the pull request opened from it reaches the reviewer with no spec.
// That drops the effective tier one level on exactly the work a human most
// needs the Spec axis to cover — agent-authored.
//
// The fix stays inside the existing discovery order: the orchestrator writes an
// empty first commit on the branch it creates, carrying a closing reference the
// commit step already reads. Nothing about resolve-spec.mjs changes. See
// ADR 0076.
//
// A pull request body is deliberately NOT a spec source, so this cannot be
// solved by having the agent describe its own work — see the same ADR.

/** The reference keywords `resolve-spec.mjs` matches; `Closes` is one of them. */
const CLOSING_KEYWORD = 'Closes';

/**
 * Pure: the anchor commit message for a branch created around one issue.
 *
 * The subject says what the commit is for, because it is the oldest commit on
 * the branch and shows up in every log of it. The trailer is the payload: one
 * `Closes #<n>`, which both GitHub and the spec resolver read.
 *
 * @param {{ branch: string, issue: number, title?: string }} input
 * @returns {string}
 */
export const specAnchorMessage = ({ branch, issue, title }) => {
  if (!Number.isInteger(issue) || issue <= 0) {
    throw new Error(`spec anchor needs a positive issue number, got ${issue}`);
  }
  if (!branch) throw new Error('spec anchor needs a branch name');
  return [
    `chore(sandcastle): anchor ${branch} to #${issue}`,
    '',
    `\`${branch}\` carries no issue number in its name, so this empty commit`,
    'carries the reference instead. It is the oldest commit on the branch, and',
    '`/code-review` reads it through the commit step of its existing spec',
    'discovery order — see ADR 0076 and AGENTS.md "Branch naming".',
    ...(title ? ['', `Issue: ${title}`] : []),
    '',
    `${CLOSING_KEYWORD} #${issue}`,
  ].join('\n');
};

/**
 * Pure: whether a branch already carries its issue where the resolver looks
 * first. A branch named `<type>/<issue>-<slug>` needs no anchor; `feat/<slug>`
 * and the reserved `claude/…` / `copilot/…` prefixes do.
 *
 * Kept in step with `BRANCH_ISSUE` in tools/scripts/review/resolve-spec.mjs:
 * the anchor exists to cover exactly what that regex misses.
 *
 * @param {string} branch
 */
export const branchNameCarriesIssue = (branch) =>
  /^[a-z]+\/(\d+)-/.test(branch);
