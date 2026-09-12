/**
 * Splitting a documented shell command into tokens.
 *
 * Two checkers need the same split and needed it differently at first:
 * `check-doc-commands.mjs` asks which tokens name a file, and
 * `check-review-tool-allowlist.mjs` asks whether a command's leading tokens
 * are the ones an allowlist entry permits. Both answers are wrong the moment
 * the split is wrong, and both are wrong in the same way — a quoted argument
 * cut on its spaces becomes several tokens nobody wrote. `"Vault Trust
 * Boundary.dc.html"` is one filename; `sed -n '1,20p'` is three tokens, not
 * four.
 *
 * So the split lives here rather than as a copy in each file, for the reason
 * `tools/scripts/review/cli.mjs` gives for its own contents: two copies of one
 * rule drift, and the drift is silent.
 */

/**
 * Split one command line into tokens, keeping a quoted argument whole.
 *
 * The quotes are dropped from the token, which is what both callers want: a
 * path is compared against the filesystem and an argument against an allowlist
 * entry, and neither comparison is about how the argument was quoted.
 *
 * @param {string} command
 * @returns {string[]}
 */
export function tokenize(command) {
  const tokens = [];
  for (const match of command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}
