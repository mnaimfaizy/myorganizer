/**
 * Pure decision logic for how `yarn ai:create-pr` pushes the current branch.
 *
 * The runner used to do one thing: `git push origin HEAD`. That is correct for a branch
 * that only ever grows, and wrong for every branch that has been rebased — which is the
 * normal state of a PR branch after its base moves. The push is rejected as a
 * non-fast-forward, and because the runner is the ONLY sanctioned way to push (AGENTS.md
 * forbids `git push` directly), there was no path forward inside the workflow at all.
 *
 * Forcing is the answer, but a bare `--force` — or even a bare `--force-with-lease` — is
 * not. A bare lease compares against the remote-tracking ref, which any background fetch
 * can quietly refresh, and at that point the lease protects nothing. So this module always
 * pins the lease to the SHA the runner actually observed.
 *
 * The second hazard is worse and a lease cannot see it: divergence does not prove a rebase.
 * Someone else — a teammate, another machine, a `claude/` or `copilot/` agent — may have
 * pushed real commits to the same branch, and forcing would destroy them. `git cherry`
 * answers this exactly, by patch-id: a remote commit with an equivalent change already in
 * the local branch is a rebase artifact and safe to drop; one without is somebody's work.
 * Unmatched remote commits therefore refuse the push regardless of the flag.
 *
 * Run the tests with: yarn ai:create-pr:test
 */

/** What the runner should do about pushing, once the branch state is known. */
export const PUSH_ACTIONS = Object.freeze({
  /** Upstream is already at this commit. */
  upToDate: 'up-to-date',
  /** No upstream yet — publish the branch and set tracking. */
  setUpstream: 'set-upstream',
  /** Upstream is a strict ancestor — an ordinary push. */
  fastForward: 'fast-forward',
  /** Histories diverged by rebase only — a lease-pinned force. */
  forceWithLease: 'force-with-lease',
});

/** The flag a caller passes to opt into rewriting a diverged remote branch. */
export const FORCE_FLAG = '--force-with-lease';

/**
 * Decide how to push, or refuse with a reason.
 *
 * Every input is a plain value so the whole decision is testable without a git repo; the
 * runner is responsible for measuring them.
 *
 * @param {object} input
 * @param {boolean} input.hasUpstream          Whether `@{u}` resolves.
 * @param {number}  input.ahead                Commits on HEAD that upstream lacks.
 * @param {number}  input.behind               Commits on upstream that HEAD lacks.
 * @param {string}  input.branch               Short branch name, for the lease ref.
 * @param {string}  [input.remoteSha]          The observed upstream commit, for the lease.
 * @param {boolean} [input.forceWithLease]     Whether the caller passed the flag.
 * @param {string[]} [input.unmatchedRemoteCommits]
 *        Upstream commits with NO patch-equivalent in the local branch — i.e. the `+`
 *        lines of `git cherry HEAD @{u}`. Non-empty means forcing would destroy work.
 * @returns {{action: string, args?: string[], reason?: string} | {error: string}}
 */
export function decidePushPlan({
  hasUpstream,
  ahead,
  behind,
  branch,
  remoteSha,
  forceWithLease = false,
  unmatchedRemoteCommits = [],
}) {
  if (!hasUpstream) {
    return {
      action: PUSH_ACTIONS.setUpstream,
      args: ['push', '-u', 'origin', 'HEAD'],
      reason: 'the branch has no upstream yet',
    };
  }

  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    return {
      error:
        'Could not count commits against the upstream branch. Fetch and try again.',
    };
  }

  const diverged = ahead > 0 && behind > 0;

  if (!diverged) {
    if (ahead > 0) {
      return {
        action: PUSH_ACTIONS.fastForward,
        args: ['push', 'origin', 'HEAD'],
        reason: `${ahead} commit(s) ahead of the upstream branch`,
      };
    }
    if (behind > 0) {
      return {
        error:
          'The local branch is behind its upstream branch. Pull or rebase before creating the PR.',
      };
    }
    return {
      action: PUSH_ACTIONS.upToDate,
      reason: 'the upstream branch already points at this commit',
    };
  }

  // Diverged from here down.
  if (unmatchedRemoteCommits.length > 0) {
    const listed = unmatchedRemoteCommits.map((sha) => `  ${sha}`).join('\n');
    return {
      error:
        `The upstream branch has ${unmatchedRemoteCommits.length} commit(s) with no equivalent in this branch:\n` +
        `${listed}\n` +
        'Forcing would destroy them. Integrate them first (git pull --rebase), then push.',
    };
  }

  if (!forceWithLease) {
    return {
      error:
        `The local branch and its upstream have diverged (${ahead} local, ${behind} remote), but every ` +
        'upstream commit already has an equivalent here — the signature of a rebase.\n' +
        `Re-run with ${FORCE_FLAG} to replace the remote branch with this one.`,
    };
  }

  if (typeof remoteSha !== 'string' || remoteSha.trim() === '') {
    return {
      error:
        'Refusing to force: the current upstream commit could not be resolved, so the lease ' +
        'cannot be pinned to it.',
    };
  }

  // Pin the lease to the SHA we measured, never the bare form: a bare --force-with-lease
  // trusts the remote-tracking ref, which a concurrent `git fetch` can advance behind our
  // back, and the safety disappears exactly when it is needed.
  return {
    action: PUSH_ACTIONS.forceWithLease,
    args: [
      'push',
      `${FORCE_FLAG}=${branch}:${remoteSha.trim()}`,
      'origin',
      'HEAD',
    ],
    reason: `rebased onto a new base; replacing ${behind} superseded remote commit(s)`,
  };
}

/**
 * Split the output of `git cherry <head> <upstream>` into the upstream commits that have
 * no patch-equivalent locally (`+`) and those that do (`-`).
 *
 * @param {string} stdout
 * @returns {{unmatched: string[], equivalent: string[]}}
 */
export function parseCherryOutput(stdout) {
  const unmatched = [];
  const equivalent = [];

  for (const line of String(stdout ?? '').split('\n')) {
    const match = /^([+-])\s+([0-9a-f]{7,40})$/.exec(line.trim());
    if (!match) continue;
    (match[1] === '+' ? unmatched : equivalent).push(match[2]);
  }

  return { unmatched, equivalent };
}
