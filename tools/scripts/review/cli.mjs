/**
 * Shared CLI plumbing for the review scripts: flag parsing, the exit-2
 * "could not run" helper, and the is-main guard. Kept here so the validator
 * and the renderer do not each carry a differently shaped copy.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Split argv into `{ positional, flags }`. A flag is `--name value`; a flag
 * given twice keeps the last value; a flag with no value is `null`.
 */
export const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[arg.slice(2)] = null;
    } else {
      flags[arg.slice(2)] = next;
      i += 1;
    }
  }
  return { positional, flags };
};

/** Exit 2: the script could not run. Distinct from exit 1, a rejected report. */
export const cannotRun = (prefix) => (msg) => {
  console.error(`${prefix}: ${msg}`);
  process.exit(2);
};

export const readJsonOr = (path, onError) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return onError(`cannot read ${path}: ${err.message}`);
  }
};

/**
 * The one way the review scripts call `gh`. Only the spec resolver and the
 * publisher use it, and only from steps that hold the job token; the
 * reviewer itself never does (ADR 0071 item 8).
 */
export const gh = (args, input) => {
  const opts = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
  if (input !== undefined) opts.input = input;
  return execFileSync('gh', args, opts);
};
export const ghJson = (args, input) => JSON.parse(gh(args, input) || 'null');
export const ghGraphql = (query, variables) =>
  ghJson(
    ['api', 'graphql', '--input', '-'],
    JSON.stringify({ query, variables }),
  );

/** True when `moduleUrl` is the script node was asked to run. */
export const isMain = (moduleUrl) =>
  Boolean(process.argv[1]) &&
  fileURLToPath(moduleUrl) ===
    fileURLToPath(
      new URL(
        `file://${process.argv[1].replace(/\\/g, '/').replace(/^([A-Za-z]:)/, '/$1')}`,
      ),
    );
