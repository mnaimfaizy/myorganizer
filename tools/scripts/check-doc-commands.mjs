#!/usr/bin/env node
// Asserts that a shell command printed in a Markdown doc names files that exist.
//
//   node tools/scripts/check-doc-commands.mjs
//
// A documented command is a claim about the repository: "run this, against these files." The
// claim rots the ordinary way — a script is renamed, an input is never committed — and nothing
// notices, because prose is not executed. `docs/vault/README.md` advertised a rebuild of the
// vault pages from a `.dc.html` design export that has never existed in this repository, and the
// contradiction was found by a human following the instruction and failing (issue #534).
//
// This is an Assertion Gate in the sense of ADR 0043: it compares two artifacts — the paths a
// fenced command names, and the filesystem — and names the path that is wrong. It never asks
// whether a doc was touched.
//
// What it reads: every fenced `bash`/`sh`/`shell`/`console` block in every tracked `*.md`.
// What it asserts: a token that looks like a repo-relative path under a known top-level
// directory, or any token ending in `.dc.html`, resolves on disk.
//
// What it deliberately skips, and why:
//
//   - Placeholders. `<export-dir>`, `$BRANCH`, `*.spec.ts` are not claims about a file; they are
//     holes for the reader to fill. A checker that failed them would make every usage example
//     unwritable.
//   - Build outputs. A path git ignores is generated, so its absence in a clean tree is correct
//     rather than drift — `libs/web-ui/storybook-static` is documented and must stay documented.
//     Deferring to `.gitignore` keeps that judgement in one place instead of in an opt-out list
//     someone has to remember to prune.
//
// Exit 0 = every documented path resolves. Exit 1 = at least one does not. Exit 2 = cannot run.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const fail = (msg) => {
  console.error(`doc-commands: ${msg}`);
  process.exit(2);
};

/**
 * Top-level directories a token must start under to read as a repo path. A bare `package.json`
 * or `main` is not a path claim, and `src/index.ts` inside an illustrative snippet is a path
 * relative to somewhere this checker cannot know. Anchoring at a real top-level directory is
 * what separates "the doc names a file in this repo" from "the doc shows some code".
 */
const ROOTS = [
  '.agents/',
  '.claude/',
  '.cursor/',
  '.github/',
  '.husky/',
  'apps/',
  'docs/',
  'libs/',
  'tools/',
];

const FENCE = /```(?:bash|sh|shell|console)\n([\s\S]*?)```/g;

/** A token with a shell placeholder, variable, or glob in it is not naming one file. */
const isPlaceholder = (token) => /[<>${}*?|!]/.test(token);

/**
 * Split one command line into tokens, keeping a quoted argument whole. `"Vault Trust
 * Boundary.dc.html"` is one filename; splitting on whitespace turns it into three tokens and the
 * check then asserts against a name nobody wrote.
 */
export function tokenize(line) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const m of line.matchAll(pattern)) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

/** Strip shell and prose punctuation a path picks up in running text. */
export function clean(token) {
  return token.replace(/^[('"`]+/, '').replace(/[)'"`,;:.]+$/, '');
}

/** Does this token claim to name a file in this repository? */
export function isRepoPath(token) {
  if (isPlaceholder(token)) return false;
  return (
    ROOTS.some((root) => token.startsWith(root)) || token.endsWith('.dc.html')
  );
}

let ignoredCache = null;

/**
 * Paths git ignores, resolved in one batch.
 *
 * `check-ignore` exits 1 when none of the input paths are ignored, which is an answer rather than
 * a failure — so this reads the status instead of letting a throwing `execFileSync` turn "nothing
 * is a build output" into a crash. That is exactly what it did until the fixture for a repo with
 * no matching ignore rule caught it.
 */
function gitIgnores(paths) {
  if (paths.length === 0) return new Set();
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    input: paths.join('\n'),
    encoding: 'utf8',
  });
  if (result.error)
    fail(`could not run git check-ignore: ${result.error.message}`);
  if (result.status !== 0 && result.status !== 1) {
    fail(`git check-ignore exited ${result.status}`);
  }
  return new Set((result.stdout ?? '').split('\n').filter(Boolean));
}

function trackedMarkdown() {
  try {
    return execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return fail(
      'could not list tracked Markdown files — is this a git repository?',
    );
  }
}

const files = trackedMarkdown();
if (files.length === 0) fail('no tracked Markdown files found');

/** Every path claim in the corpus, before existence is considered. */
const claims = [];
for (const file of files) {
  if (!existsSync(file)) continue; // staged-deleted but still tracked
  const text = readFileSync(file, 'utf8');
  for (const block of text.matchAll(FENCE)) {
    for (const line of block[1].split('\n')) {
      if (line.trim().startsWith('#')) continue; // a shell comment, not a command
      for (const token of tokenize(line)) {
        const path = clean(token);
        if (path && isRepoPath(path)) claims.push({ file, path });
      }
    }
  }
}

const missing = claims.filter((claim) => !existsSync(claim.path));

// Only the missing ones need the ignore lookup, so a clean tree pays one subprocess at most.
ignoredCache = gitIgnores([...new Set(missing.map((m) => m.path))]);

const findings = missing.filter((claim) => !ignoredCache.has(claim.path));

if (findings.length > 0) {
  console.error(
    `doc-commands: ${findings.length} finding(s) — a documented command names a file that does not exist\n`,
  );
  for (const { file, path } of findings) {
    console.error(`  - ${file} → ${path}`);
  }
  console.error(
    '\nEither commit the file, or correct the doc. A command a reader cannot run is a claim' +
      '\nthis repository does not honour (ADR 0043).',
  );
  process.exit(1);
}

console.log(
  `doc-commands: OK — ${claims.length} documented paths across ${files.length} Markdown files resolve`,
);
