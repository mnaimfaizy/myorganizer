#!/usr/bin/env node
// Asserts that every command the code-review skill and the Review Checklist
// instruct the reviewer to run is a command the reviewer's tool allowlist
// permits.
//
//   node tools/scripts/check-review-tool-allowlist.mjs [--print]
//
// Both sides are files. The instruction side is
// `.agents/skills/code-review/SKILL.md` and `docs/review/REVIEW_CHECKLIST.md`;
// the permission side is the `--allowedTools` list in
// `.github/actions/code-reviewer/action.yml`, which is what the reviewer's
// harness enforces in CI. Nothing here reads a transcript: a transcript
// artifact expires after seven days, so a check that depended on one could not
// be run against the tree at any later commit.
//
// This is the Meta-Gate's own reasoning — a checker nothing runs is not a gate
// — applied to the allowlist: an instruction the reviewer is refused
// permission to follow is an instruction nothing can carry out. It is not
// free, either. In golden replay run 45 the guard case
// `groceries-blob-type-without-fanouts` died at `error_max_turns` with 26
// permission denials against 81 turns — roughly a third of the budget spent
// being told no, and no report written at all, so the run measured nothing
// (docs/research/2026-09-10-the-answer-sheet-is-inert.md).
//
// What counts as an instruction, and why it is drawn this wide:
//
//   - Every command line in a fenced `bash`/`sh`/`shell`/`console` block.
//   - Every inline code span that reads as a command, in prose and inside any
//     other fence: its first token is a program (`yarn`, `git`, `sed`, …) and
//     it carries an argument, or it is a package.json script name.
//     `openapi:check` is how the checklist names the gate the reviewer must
//     run, and a rule that only understood a leading `yarn` would miss the one
//     obligation that instructs running anything.
//   - A script written as a *shape* rather than a name — "the `*:check`
//     gates" — expanded to every script it names. It is the broadest
//     instruction either document gives, and reading it as prose would leave
//     this gate reporting only whichever literal spellings happen to be
//     written down nearby.
//
// A checklist entry's `Why this exists` paragraph is skipped — that block is
// one of the four things the checklist says an entry answers, and it is the
// one written in the past tense. `openapi:sync` appears there because a
// release once skipped it, which is a fact about 2026 and not a command
// anybody is being handed.
//
// Under-reporting is the failure this gate exists to close, so the reading is
// deliberately broad and the suppressions are written down instead. Both
// documents have two readers — a terminal session and a CI job — and they also
// name machinery by its script name (`review:publish`, `review:spec`) while
// telling the reviewer not to run it. `NOT_THE_REVIEWERS_TO_RUN` records that
// judgement once, with a reason each, and an entry that stops matching
// anything is an error rather than a silent no-op.
//
// Matching is token-wise, not string-prefix. `Bash(sed -n:*)` permits a
// command whose first two tokens are exactly `sed` and `-n`; it permits
// nothing about `sed '1,20p' file`, which is the shape that leaves an entry
// carrying a flag matching nothing anyone was told to run. A token the
// instruction leaves as a placeholder (`<project>`, `$BRANCH`) matches
// anything, because the document did not fix it.
//
// Exit 0 = every instructed command is permitted. Exit 1 = at least one is
// refused, each named with its instruction site and the nearest entry.
// Exit 2 = could not run.
import { readFileSync } from 'node:fs';

import { tokenize } from './lib/shell-command.mjs';
import { isMain } from './review/cli.mjs';

export const ACTION = '.github/actions/code-reviewer/action.yml';
export const INSTRUCTION_SOURCES = [
  '.agents/skills/code-review/SKILL.md',
  'docs/review/REVIEW_CHECKLIST.md',
];

/**
 * First tokens that make a code span a command rather than a name.
 *
 * Written out rather than derived from the allowlist, and that is the whole
 * point: derived, the vocabulary would shrink exactly when the allowlist
 * narrows, so removing `Bash(sed -n:*)` would make every `sed` instruction
 * invisible instead of refused — the gate falling silent at the moment it has
 * something to say. Deriving is still what keeps it honest in the other
 * direction: `assertProgramVocabulary` fails when the action grants a program
 * this list does not know, so the two can only be widened together.
 */
export const PROGRAMS = new Set([
  // package managers and runtimes
  'corepack',
  'yarn',
  'npm',
  'npx',
  'pnpm',
  'node',
  'nx',
  'git',
  // the shell utilities the action grants, and the neighbours of each
  'sed',
  'awk',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'rg',
  'find',
  'ls',
  'mkdir',
  'rm',
  'cp',
  'mv',
  'echo',
  'jq',
  'gh',
  'curl',
]);

/** Fence info strings whose contents are commands rather than prose. */
const SHELL_FENCES = new Set(['bash', 'sh', 'shell', 'console']);

/**
 * Commands the two documents name but do not ask the reviewer to run, each
 * with the reason it is not the reviewer's to run. Matched as a token prefix
 * of an instructed command, with a leading `corepack` ignored on both sides:
 * the question here is which command it is, not which of the two documented
 * spellings reached the page.
 *
 * An entry matching nothing fails the check (exit 2). A suppression is a claim
 * about what a document says; when the document stops saying it, the claim is
 * stale and the next real instruction could hide behind it.
 */
export const NOT_THE_REVIEWERS_TO_RUN = [
  {
    command: 'yarn review:obligations:select',
    reason:
      'The composite action selects the worklist before the reviewer takes a turn, and the CI prompt says not to re-run the selector — tmp/code-review/obligations.json is a read.',
  },
  {
    command: 'yarn review:obligations:check',
    reason:
      'A completeness reporter over the answer sheet, run after the review and failing nothing. The skill names where completeness is reported; it does not ask the reviewer to report it.',
  },
  {
    command: 'yarn review:checklist:check',
    reason:
      "The drift gate between the checklist and the obligation catalogue, named in the checklist's Status section as the thing that holds the two forms together. Husky and CI run it.",
  },
  {
    command: 'yarn review:spec',
    reason:
      'The workflow resolves the spec with the job token before the reviewer runs. The reviewer holds no token and is told to fetch nothing (ADR 0071 item 8).',
  },
  {
    command: 'yarn review:render',
    reason:
      'Step 6 renders the report for a human at a terminal. In CI the prompt says not to render: a later job publishes.',
  },
  {
    command: 'yarn review:publish',
    reason:
      'Runs in the one job whose token can write. The reviewer must not post, label, or resolve anything, so being refused this is the design rather than a gap.',
  },
  {
    command: 'git branch --show-current',
    reason:
      'Step 2 reads the branch name to find the spec interactively. In CI the branch name is given in the prompt as a fact, along with the fixed point, the head, and the tier.',
  },
];

const die = (msg) => {
  console.error(`review-allowlist: ${msg}`);
  process.exit(2);
};

/**
 * A token the document left open — `<project>`, `$BRANCH`, `${SHA}`. It names
 * no particular value, so it can neither satisfy nor contradict an entry's
 * token and is read as matching either way.
 *
 * Deliberately not called `isPlaceholder`: `check-doc-commands.mjs` has a
 * predicate by that name asking a different question — whether a token names
 * one file — and it answers `true` for a glob, which this one must not.
 */
export const isUnfixedToken = (token) =>
  /[<>]/.test(token) || /^\$\{?\w+\}?$/.test(token);

/** Split a comma-separated tool list without cutting inside `Bash(...)`. */
export function splitToolList(list) {
  const entries = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      entries.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  entries.push(current);
  return entries.map((entry) => entry.trim()).filter(Boolean);
}

/**
 * One `--allowedTools` entry.
 *
 * `Bash(x:*)` is a prefix rule: a command whose leading tokens are `x`'s
 * tokens. `Bash(x)` is exact — the whole command, token for token. Anything
 * else (`Read`, `Agent`) grants a tool that is not the shell, and permits no
 * command at all.
 */
export function parseToolEntry(raw) {
  const trimmed = raw.trim();
  const bash = trimmed.match(/^Bash\((.*)\)$/s);
  if (!bash) return { raw: trimmed, kind: 'tool', tokens: [] };
  const inner = bash[1].trim();
  const isPrefix = inner.endsWith(':*');
  const pattern = isPrefix ? inner.slice(0, -2).trim() : inner;
  return {
    raw: trimmed,
    kind: isPrefix ? 'prefix' : 'exact',
    pattern,
    tokens: tokenize(pattern),
  };
}

/** The `--allowedTools` entries the composite action passes to the reviewer. */
export function parseAllowedTools(yaml) {
  const match = yaml.match(/--allowedTools\s+"([^"]*)"/);
  if (!match) return null;
  return splitToolList(match[1]).map(parseToolEntry);
}

/**
 * Every program the allowlist grants must be one `PROGRAMS` can recognise, or
 * an instruction to run it reads as prose and is never compared against
 * anything. That is the gate passing while the reviewer is refused, which is
 * the one outcome it exists to rule out — so it is an error, not a finding.
 *
 * Returns the granted programs the vocabulary does not know.
 */
export function unknownGrantedPrograms(entries, programs = PROGRAMS) {
  const unknown = new Set();
  for (const entry of entries) {
    if (entry.kind === 'tool') continue;
    const [program] = entry.tokens;
    if (program && !programs.has(program)) unknown.add(program);
  }
  return [...unknown];
}

const globToRegExp = (token) =>
  new RegExp(
    `^${token.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
  );

const tokenMatches = (commandToken, entryToken) => {
  if (isUnfixedToken(commandToken)) return true;
  if (entryToken.includes('*'))
    return globToRegExp(entryToken).test(commandToken);
  return commandToken === entryToken;
};

/** Would this entry permit a command with these tokens? */
export function matchesEntry(entry, commandTokens) {
  if (entry.kind === 'tool') return false;
  if (entry.tokens.length === 0) return false;
  if (entry.kind === 'exact' && commandTokens.length !== entry.tokens.length)
    return false;
  if (commandTokens.length < entry.tokens.length) return false;
  return entry.tokens.every((token, index) =>
    tokenMatches(commandTokens[index], token),
  );
}

/** How many leading tokens the entry and the command agree on. */
export function sharedPrefixLength(entry, commandTokens) {
  let shared = 0;
  while (
    shared < entry.tokens.length &&
    shared < commandTokens.length &&
    tokenMatches(commandTokens[shared], entry.tokens[shared])
  )
    shared += 1;
  return shared;
}

/**
 * The entry a reader should look at first: the one agreeing with the command
 * for longest, earliest in the list on a tie. Reporting the refusal without it
 * leaves the reader to diff a command against thirty entries by eye.
 */
export function nearestEntry(entries, commandTokens) {
  let best = null;
  for (const entry of entries) {
    if (entry.kind === 'tool') continue;
    const shared = sharedPrefixLength(entry, commandTokens);
    if (best === null || shared > best.shared) best = { entry, shared };
  }
  return best;
}

/** A script name written as a shape rather than a name: `*:check`. */
const isScriptGlob = (token) =>
  token.includes('*') && token.includes(':') && /^[a-z0-9:*-]+$/.test(token);

/**
 * The commands one line of a document asks for, as `{ command, alternatives }`
 * — one site, and the token lists that would satisfy it. A bare script name
 * has two alternatives because the repository documents two spellings of the
 * same run; a command written out has one, because that is what a reader runs.
 *
 * A script *shape* — the skill's "the `*:check` gates" and the obligation's
 * "name the `*:check` gate that covers the changed artifact" — is the broadest
 * instruction either document gives, and reading it as prose would leave the
 * gate reporting only whichever literal spellings happen to be written down
 * nearby. It expands to every script the shape names, and it is `shape: true`:
 * a shape is refused only when no script it names is permitted, and no written
 * suppression covers it, because a suppression names a command and a shape is
 * a class.
 */
export function commandsFrom(text, scripts = new Set()) {
  const source = text.trim();
  if (!source || source.startsWith('#')) return [];

  const substitutions = [...source.matchAll(/\$\(([^()]*)\)/g)].map(
    (m) => m[1],
  );
  const remainder = source.replace(/\$\(([^()]*)\)/g, ' ');

  const found = [];
  for (const piece of [remainder, ...substitutions]) {
    for (const segment of piece.split(/&&|\|\||[;|]/)) {
      const tokens = tokenize(segment.replace(/^\s*[$>]\s+/, ''));
      if (tokens.length === 0) continue;
      const [head] = tokens;
      // An argument is what separates an instruction from a name. The skill
      // writes `head` for the head SHA in running prose, and reading that as
      // the `head` utility would put a site in the corpus that nobody was ever
      // instructed to run — permitted today only because the action happens to
      // grant `head`, and a finding the day it stops.
      if (PROGRAMS.has(head) && tokens.length > 1) {
        found.push({ command: tokens.join(' '), alternatives: [tokens] });
        continue;
      }
      // A script name is only ever run through the package manager, so the
      // repository's two documented spellings are the alternatives. Requiring
      // a colon keeps `test`, `build`, and `lint` — words before they are
      // scripts — out of the corpus.
      if (head.includes(':') && scripts.has(head)) {
        found.push({
          command: ['corepack', 'yarn', ...tokens].join(' '),
          alternatives: [
            ['corepack', 'yarn', ...tokens],
            ['yarn', ...tokens],
          ],
        });
        continue;
      }
      if (tokens.length === 1 && isScriptGlob(head)) {
        const named = [...scripts]
          .filter((script) => globToRegExp(head).test(script))
          .sort();
        // A shape naming no script is a shape about nothing — a stale
        // reference, which `docs:commands:check` is the gate for, not this one.
        if (named.length === 0) continue;
        found.push({
          command: `corepack yarn ${head}`,
          shape: true,
          names: named,
          alternatives: named.flatMap((script) => [
            ['corepack', 'yarn', script],
            ['yarn', script],
          ]),
        });
      }
    }
  }
  return found;
}

/**
 * Every instruction site in one document.
 *
 * `sectionId` carries the `**id**` of the checklist entry a site sits in, so a
 * refusal can name the obligation rather than only a line number. It resets at
 * every `##` heading: an id belongs to its own entry and to nothing after it.
 *
 * `**Why this exists**` starts the entry's incident history, which runs to the
 * end of the entry. It names the commands a past release ran or failed to run,
 * in the past tense, and instructs nobody.
 */
export function extractInstructions(text, { file, scripts = new Set() } = {}) {
  const sites = [];
  let fence = null;
  let sectionId = null;
  let inHistory = false;

  text.split('\n').forEach((line, index) => {
    const fenceMatch = line.match(/^\s*```(\S*)/);
    if (fenceMatch) {
      fence = fence === null ? fenceMatch[1].toLowerCase() : null;
      return;
    }

    const push = (text_) => {
      for (const command of commandsFrom(text_, scripts))
        sites.push({ file, line: index + 1, sectionId, ...command });
    };

    // A shell fence is a list of commands, so every line is one. Any other
    // fence is read the way prose is — by its inline spans — because the
    // skill's reach-through block is an unlabelled fence pasted verbatim into
    // a sub-agent prompt, and its item 3 hands the reviewer a `git grep`
    // invocation. Skipping the whole fence would hide a block of instructions
    // for being formatted like a quotation. The finding-contract fence carries
    // no spans, so it still yields nothing.
    if (fence !== null) {
      if (inHistory) return;
      if (SHELL_FENCES.has(fence)) push(line);
      else for (const span of line.matchAll(/`([^`]+)`/g)) push(span[1]);
      return;
    }

    if (/^##\s/.test(line) || /^---\s*$/.test(line)) {
      sectionId = null;
      inHistory = false;
    }
    const idMatch = line.match(/^\*\*id\*\*\s+`([^`]+)`/);
    if (idMatch) sectionId = idMatch[1];
    if (/^\*\*Why this exists\*\*/.test(line)) inHistory = true;
    if (inHistory) return;

    for (const span of line.matchAll(/`([^`]+)`/g)) push(span[1]);
  });

  return dedupe(sites);
}

const dedupe = (sites) => {
  const seen = new Set();
  return sites.filter((site) => {
    const key = `${site.file}:${site.line}:${site.command}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const withoutCorepack = (tokens) =>
  tokens[0] === 'corepack' ? tokens.slice(1) : tokens;

const exemptionCovers = (exemption, site) => {
  // A suppression names one command somebody decided is not the reviewer's to
  // run. A shape is a class, and no such decision was made about a class.
  if (site.shape) return false;
  const wanted = withoutCorepack(tokenize(exemption.command));
  return site.alternatives.some((alternative) => {
    const tokens = withoutCorepack(alternative);
    return (
      tokens.length >= wanted.length &&
      wanted.every((token, index) => tokens[index] === token)
    );
  });
};

/**
 * Compares the instruction sites against the allowlist.
 *
 * Returns `{ ok, findings, exempted, staleExemptions, permitted }`. A finding
 * is one site no entry would permit; `staleExemptions` are suppressions that
 * matched nothing, which the caller treats as "could not run" rather than as a
 * finding — the list has stopped describing the documents.
 */
export function assertToolAllowlist({
  entries = [],
  sites = [],
  exemptions = NOT_THE_REVIEWERS_TO_RUN,
}) {
  const used = new Set();
  const findings = [];
  const exempted = [];
  const permitted = [];

  for (const site of sites) {
    const exemption = exemptions.find((candidate) =>
      exemptionCovers(candidate, site),
    );
    if (exemption) {
      used.add(exemption.command);
      exempted.push({ site, exemption });
      continue;
    }

    const allowed = site.alternatives.some((alternative) =>
      entries.some((entry) => matchesEntry(entry, alternative)),
    );
    if (allowed) {
      permitted.push(site);
      continue;
    }

    findings.push({
      site,
      nearest: nearestEntry(entries, site.alternatives[0]),
    });
  }

  const staleExemptions = exemptions.filter(
    (exemption) => !used.has(exemption.command),
  );

  return {
    ok: findings.length === 0 && staleExemptions.length === 0,
    findings,
    exempted,
    staleExemptions,
    permitted,
  };
}

/** One finding, as the lines a reader needs to act on it. */
export function formatFinding({ site, nearest }) {
  const where = site.sectionId
    ? `${site.file}:${site.line} (obligation ${site.sectionId})`
    : `${site.file}:${site.line}`;
  const shape = site.shape
    ? ` (a shape: ${site.names.length} script(s) match it, none permitted)`
    : '';
  const lines = [`  - ${where}`, `      instructed: ${site.command}${shape}`];
  if (!nearest || nearest.shared === 0) {
    lines.push(
      `      nearest:    none — no Bash entry begins with \`${site.alternatives[0][0]}\``,
    );
    return lines.join('\n');
  }
  const shared = nearest.entry.tokens.slice(0, nearest.shared).join(' ');
  const required = nearest.entry.tokens[nearest.shared];
  lines.push(
    `      nearest:    ${nearest.entry.raw} — permits \`${shared}\`` +
      (required === undefined
        ? ', and nothing longer'
        : `, then requires \`${required}\``),
  );
  return lines.join('\n');
}

const main = () => {
  let action;
  try {
    action = readFileSync(ACTION, 'utf8');
  } catch (err) {
    die(`cannot read ${ACTION}: ${err.message}`);
  }

  const entries = parseAllowedTools(action);
  if (entries === null)
    die(
      `${ACTION} has no --allowedTools "..." list; this check cannot tell what the reviewer may run`,
    );
  if (!entries.some((entry) => entry.kind !== 'tool'))
    die(
      `${ACTION}'s --allowedTools list grants no Bash entry at all; that is a rewrite this check has not been taught to read`,
    );

  const unknown = unknownGrantedPrograms(entries);
  if (unknown.length)
    die(
      `${ACTION} grants ${unknown.map((p) => `\`${p}\``).join(', ')}, which this check's ` +
        'program vocabulary does not include, so an instruction to run it would read as prose ' +
        'and never be compared against anything. Add it to PROGRAMS in ' +
        'tools/scripts/check-review-tool-allowlist.mjs.',
    );

  let scripts;
  try {
    scripts = new Set(
      Object.keys(
        JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {},
      ),
    );
  } catch (err) {
    die(`cannot read package.json: ${err.message}`);
  }

  const sites = [];
  for (const file of INSTRUCTION_SOURCES) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      die(`cannot read ${file}: ${err.message}`);
    }
    const found = extractInstructions(text, { file, scripts });
    // A parser that reads nothing passes everything, and both documents have
    // instructed a command since the day they were written.
    if (found.length === 0)
      die(
        `${file} yielded no commands — the document's shape changed and this check stopped seeing anything`,
      );
    sites.push(...found);
  }

  const result = assertToolAllowlist({ entries, sites });

  if (process.argv.includes('--print')) {
    for (const entry of entries)
      console.log(
        `entry:   ${entry.raw}${entry.kind === 'tool' ? ' (not a command)' : ''}`,
      );
    for (const site of result.permitted)
      console.log(`allowed: ${site.file}:${site.line} ${site.command}`);
    for (const { site, exemption } of result.exempted)
      console.log(
        `exempt:  ${site.file}:${site.line} ${site.command} — ${exemption.reason}`,
      );
  }

  if (result.staleExemptions.length) {
    console.error(
      `review-allowlist: ${result.staleExemptions.length} suppression(s) match nothing the documents say:`,
    );
    for (const exemption of result.staleExemptions)
      console.error(`  - \`${exemption.command}\` — "${exemption.reason}"`);
    console.error(
      '\nDrop the entry. A suppression for an instruction nobody gives is a hole the next one falls into.',
    );
    process.exit(2);
  }

  if (result.findings.length) {
    console.error(
      `review-allowlist: ${result.findings.length} finding(s) — the reviewer is instructed to run a command its tool allowlist refuses\n`,
    );
    for (const finding of result.findings)
      console.error(formatFinding(finding));
    console.error(
      `\nEither widen the --allowedTools list in ${ACTION}, or stop instructing the` +
        '\nreviewer to run it. A refused command is not free: run 45 spent 26 permission' +
        '\ndenials of an 81-turn budget and wrote no report at all, so the guard case it' +
        '\nwas measuring scored nothing.',
    );
    process.exit(1);
  }

  console.log(
    `review-allowlist: OK — ${result.permitted.length} instructed command(s) across ` +
      `${INSTRUCTION_SOURCES.length} documents are permitted by ${ACTION} ` +
      `(${result.exempted.length} site(s) suppressed by written reason)`,
  );
};

// Behind an isMain guard because the contract tests import the matcher from
// this file. Run at load, `main` exits the process the moment the documents
// and the allowlist disagree — so the tests would die before the first one
// ran, and precisely while the gate was doing its job.
if (isMain(import.meta.url)) main();
