/**
 * The one way tooling scripts call the GitHub CLI and read its output.
 *
 * `gh` returns stdout and lets a failed command throw exactly as
 * `execFileSync` threw it, so callers that report `err.stderr` or branch on
 * `err.status` keep working. `ghJson` adds one more failure a caller may want
 * to tell apart — output that is not JSON, such as an HTML error page — as a
 * `GhJsonError`. What a failure *means* stays with each caller: the release
 * script refuses a Cut, the review measurements record an unreadable lookup.
 *
 * Scripts that branch on the exit status without throwing (`spawnSync`, as
 * in `ai/create-pr.mjs`) are a different contract and do not use this.
 */
import { execFileSync } from 'node:child_process';

// `gh pr list --json files` over a few hundred Pull Requests runs to tens of
// megabytes; Node's 1 MiB default truncates it into a thrown error.
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

export class GhJsonError extends Error {
  constructor(args, stdout, cause) {
    super(`gh ${args.join(' ')} did not return JSON`, { cause });
    this.name = 'GhJsonError';
    this.args = args;
    this.stdout = stdout;
  }
}

/**
 * @param {string[]} args
 * @param {{ input?: string, maxBuffer?: number, exec?: typeof execFileSync }} [options]
 * @returns {string} stdout
 */
export function gh(
  args,
  { input, maxBuffer = DEFAULT_MAX_BUFFER, exec = execFileSync } = {},
) {
  const options = {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer,
    windowsHide: true,
  };
  if (input !== undefined) options.input = input;
  return exec('gh', args, options);
}

/**
 * `gh`, parsed. Empty output is `null`.
 * @param {string[]} args
 * @param {Parameters<typeof gh>[1]} [options]
 */
export function ghJson(args, options) {
  const stdout = gh(args, options);
  try {
    return JSON.parse(stdout || 'null');
  } catch (error) {
    throw new GhJsonError(args, stdout, error);
  }
}
