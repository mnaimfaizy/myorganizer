#!/usr/bin/env node
// Resolves the spec source for a CI code review (SKILL.md step 2) with the
// job token, so the reviewer never holds one (ADR 0070 item 8).
//
//   node tools/scripts/review/resolve-spec.mjs --head-ref <branch> \
//     --base <sha> --head <sha> --out <spec.json> [--repo owner/name]
//
// Order is the skill's: the branch name (`<type>/<issue>-<slug>`), then an
// issue reference in a commit subject or body, otherwise `none`. The issue
// is fetched with `gh issue view` and written beside the resolved source:
//
//   { "spec": { "kind": "issue", "ref": "#123", "foundBy": "branch" },
//     "title": "...", "body": "..." }
//
// The body is untrusted text (ADR 0070 item 4); it is written verbatim for
// the reviewer to quote, never interpreted here.
//
// Exit 0 = written (a `none` spec is a valid result). Exit 2 = could not run.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { cannotRun, ghJson, isMain, parseArgs } from './cli.mjs';

const BRANCH_ISSUE = /^[a-z]+\/(\d+)-/;
// A commit reference is a keyword and a number, the shapes GitHub links
// to an issue. A bare `#N` is not one: `(#123)` is the squash-merge PR
// number and `item #4` is an ADR citation.
const COMMIT_ISSUE =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|see|issue)\s+#(\d+)\b/i;

/**
 * Pure: which issue, and how it was found. Branch first, then commits, in
 * commit order (oldest first is what `git log --reverse` hands us). A commit
 * counts only when it names the issue the way GitHub does (`closes #12`,
 * `refs #12`, `fix #12`); a bare `#12` is a PR number or a citation.
 *
 * @param {{ headRef?: string, commits?: string[] }} input
 */
export const discoverSpec = ({ headRef, commits = [] }) => {
  const fromBranch = headRef?.match(BRANCH_ISSUE);
  if (fromBranch)
    return { kind: 'issue', ref: `#${fromBranch[1]}`, foundBy: 'branch' };
  for (const message of commits) {
    const hit = message.match(COMMIT_ISSUE);
    if (hit) return { kind: 'issue', ref: `#${hit[1]}`, foundBy: 'commits' };
  }
  return { kind: 'none', foundBy: 'none' };
};

export const main = (argv) => {
  const bail = cannotRun('review-spec');
  const { flags } = parseArgs(argv);
  const out = flags.out;
  if (!out) bail('--out <spec.json> is required');
  if (!flags.base || !flags.head) bail('--base and --head are required');

  const commits = execFileSync(
    'git',
    ['log', '--reverse', '--format=%s%n%b', `${flags.base}..${flags.head}`],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);

  const spec = discoverSpec({ headRef: flags['head-ref'], commits });
  const result = { spec };
  if (spec.kind === 'issue') {
    const repoArgs = flags.repo ? ['--repo', flags.repo] : [];
    try {
      const issue = ghJson([
        'issue',
        'view',
        spec.ref.slice(1),
        ...repoArgs,
        '--json',
        'title,body,state',
      ]);
      result.title = issue.title;
      result.body = issue.body ?? '';
      result.state = issue.state;
    } catch (err) {
      bail(`cannot fetch ${spec.ref}: ${err.message}`);
    }
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `review-spec: ${spec.kind === 'issue' ? `${spec.ref} (found by ${spec.foundBy})` : 'none'} → ${out}`,
  );
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
