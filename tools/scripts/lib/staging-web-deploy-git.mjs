/**
 * The two questions Staging's web deploy asks of git (issue #1138, ADR 0128).
 *
 * Kept apart from staging-web-deploy.mjs, which decides and never runs a
 * process, so the decisions stay testable without a repository — and tested
 * here against a real one, because a pair of swapped arguments would pass
 * every test that stubs the answer.
 *
 * Both answer false for a commit git does not know: an unknown commit is
 * evidence of nothing.
 *
 * Run the tests with: yarn staging-web:test
 */
import { spawnSync } from 'node:child_process';

const git = (cwd, ...args) =>
  spawnSync('git', args, { cwd, stdio: 'ignore' }).status;

const isCommit = (cwd, sha) =>
  git(cwd, 'cat-file', '-e', `${sha}^{commit}`) === 0;

/**
 * Whether `ancestor` is in the history of `descendant` and is not the same
 * commit. Strict on purpose: `git merge-base --is-ancestor` calls a commit
 * its own ancestor, and "Staging holds a newer commit" must not be true of
 * the commit being compared with itself.
 */
export function isStrictAncestor(ancestor, descendant, { cwd } = {}) {
  if (ancestor === descendant) return false;
  if (!isCommit(cwd, ancestor) || !isCommit(cwd, descendant)) return false;
  return git(cwd, 'merge-base', '--is-ancestor', ancestor, descendant) === 0;
}

/** Whether `path`, as it was at `sha`, contains `needle` as a fixed string. */
export function fileAtCommitMentions(sha, path, needle, { cwd } = {}) {
  if (!isCommit(cwd, sha)) return false;
  return git(cwd, 'grep', '-q', '-F', needle, sha, '--', path) === 0;
}
