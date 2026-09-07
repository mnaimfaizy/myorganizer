#!/usr/bin/env node
// Posts a code review to its Pull Request (ADR 0070 item 8). This is the
// only review script that talks to GitHub, and it runs after the reviewer
// has exited: the token is in this step's environment and nowhere near the
// model.
//
//   node tools/scripts/review/publish-review-report.mjs --pr <n> --repo <owner/name> \
//     --head <sha> --run-url <url> [--tier <review:label>] \
//     ( --normalized <normalized.json> --rendered <report.md> | --rejected <reason.txt> )
//     [--dry-run]
//
// What it does, all decided by publish.mjs and only executed here:
//   - posts a new summary comment and marks the previous one outdated
//     (never deleted, never rewritten)
//   - posts an inline comment for each blocking finding with a location
//     whose thread is not already open
//   - resolves the threads of findings that are no longer reported
//   - relabels the Pull Request when the verdict or the effective tier says
//     it must be human
//
// Exit 0 = posted (even when the verdict is request-changes: the workflow
// reads the verdict from the normalized report and fails the check itself).
// Exit 2 = could not run or could not post.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import { planPublication } from './publish.mjs';

const gh = (args, input) => {
  const opts = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
  if (input !== undefined) opts.input = input;
  return execFileSync('gh', args, opts);
};
const ghJson = (args, input) => JSON.parse(gh(args, input) || 'null');
const graphql = (query, variables) =>
  ghJson(
    ['api', 'graphql', '--input', '-'],
    JSON.stringify({ query, variables }),
  );

const THREADS_QUERY = `
  query($owner: String!, $name: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { id isResolved comments(first: 1) { nodes { body databaseId } } }
        }
      }
    }
  }`;
const RESOLVE_THREAD = `
  mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { isResolved } } }`;
const MINIMIZE = `
  mutation($id: ID!) { minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) { minimizedComment { isMinimized } } }`;

const openThreadsOf = ({ owner, name, number }) => {
  const threads = [];
  let after = null;
  for (;;) {
    const page = graphql(THREADS_QUERY, { owner, name, number, after }).data
      .repository.pullRequest.reviewThreads;
    for (const t of page.nodes)
      if (!t.isResolved)
        threads.push({
          id: t.id,
          body: t.comments.nodes[0]?.body ?? '',
          firstCommentId: t.comments.nodes[0]?.databaseId,
        });
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return threads;
};

export const main = (argv) => {
  const bail = cannotRun('review-publish');
  const { flags } = parseArgs(argv);
  for (const k of ['pr', 'repo', 'head', 'run-url'])
    if (!flags[k]) bail(`--${k} is required`);
  const dryRun = 'dry-run' in flags;
  const repo = flags.repo;
  const [owner, name] = repo.split('/');
  const pr = flags.pr;
  const number = Number(pr);

  let normalized;
  let rendered;
  let rejectedReason;
  if (flags.rejected) {
    rejectedReason =
      readFileSync(flags.rejected, 'utf8') || '(no reason recorded)';
  } else {
    if (!flags.normalized || !flags.rendered)
      bail(
        '--normalized and --rendered are required unless --rejected is given',
      );
    normalized = readJsonOr(flags.normalized, bail);
    rendered = readFileSync(flags.rendered, 'utf8');
  }

  const prView = ghJson(['pr', 'view', pr, '--repo', repo, '--json', 'labels']);
  const currentLabels = prView.labels.map((l) => l.name);
  const issueComments = ghJson([
    'api',
    `repos/${repo}/issues/${pr}/comments`,
    '--paginate',
    '--slurp',
  ]).flat();
  const openThreads = openThreadsOf({ owner, name, number });

  const plan = planPublication({
    normalized,
    rendered,
    rejectedReason,
    tier: flags.tier ?? null,
    headSha: flags.head,
    runUrl: flags['run-url'],
    currentLabels,
    existingComments: issueComments.map((c) => ({
      nodeId: c.node_id,
      body: c.body ?? '',
      // REST does not expose minimization; the mutation is idempotent, so a
      // second OUTDATED mark on an already-minimized comment is harmless.
      minimized: false,
    })),
    openThreads,
  });

  const say = (msg) =>
    console.log(`review-publish: ${dryRun ? '[dry-run] ' : ''}${msg}`);
  const act = (description, fn) => {
    if (dryRun) {
      say(`would ${description}`);
      return null;
    }
    const result = fn();
    say(description);
    return result;
  };
  // After the summary is up, nothing else may abort the run: a refused
  // thread resolution or relabel is reported and the verdict still stands.
  const warnings = [];
  const tryAct = (description, fn, fallback) => {
    try {
      return act(description, fn);
    } catch (err) {
      const why = firstLine(err);
      warnings.push(`${description}: ${why}`);
      say(`could not ${description}: ${why}`);
      if (fallback && !dryRun) {
        try {
          fallback();
        } catch (inner) {
          say(`fallback failed too: ${firstLine(inner)}`);
        }
      }
      return null;
    }
  };

  for (const nodeId of plan.outdate)
    tryAct(`mark previous summary ${nodeId} outdated`, () =>
      graphql(MINIMIZE, { id: nodeId }),
    );

  act(`post a new summary comment (${plan.summary.length} chars)`, () =>
    ghJson(
      [
        'api',
        `repos/${repo}/issues/${pr}/comments`,
        '--method',
        'POST',
        '--input',
        '-',
      ],
      JSON.stringify({ body: plan.summary }),
    ),
  );

  if (plan.inline.length) {
    const comments = plan.inline.map((c) => ({
      path: c.path,
      line: c.line,
      side: 'RIGHT',
      ...(c.startLine ? { start_line: c.startLine, start_side: 'RIGHT' } : {}),
      body: c.body,
    }));
    const where = plan.inline.map((c) => `${c.path}:${c.line}`).join(', ');
    if (dryRun) {
      say(`would post ${comments.length} inline comment(s): ${where}`);
    } else {
      // One review with every comment; if GitHub refuses (a line outside the
      // diff), fall back to one comment at a time so the rest still land.
      try {
        gh(
          [
            'api',
            `repos/${repo}/pulls/${pr}/reviews`,
            '--method',
            'POST',
            '--input',
            '-',
          ],
          JSON.stringify({
            commit_id: flags.head,
            event: 'COMMENT',
            body: '',
            comments,
          }),
        );
        say(`posted ${comments.length} inline comment(s): ${where}`);
      } catch (err) {
        say(
          `batched inline post refused (${firstLine(err)}); posting one at a time`,
        );
        let posted = 0;
        for (const c of comments) {
          try {
            gh(
              [
                'api',
                `repos/${repo}/pulls/${pr}/comments`,
                '--method',
                'POST',
                '--input',
                '-',
              ],
              JSON.stringify({ commit_id: flags.head, ...c }),
            );
            posted += 1;
          } catch (inner) {
            say(`skipped ${c.path}:${c.line}: ${firstLine(inner)}`);
          }
        }
        say(`posted ${posted}/${comments.length} inline comment(s)`);
      }
    }
  }

  for (const threadId of plan.resolve) {
    const thread = openThreads.find((t) => t.id === threadId);
    tryAct(
      `resolve thread ${threadId} (finding no longer reported)`,
      () => graphql(RESOLVE_THREAD, { id: threadId }),
      // The job token is sometimes refused the mutation; a reply in the
      // thread says the same thing to a human reader.
      () =>
        thread?.firstCommentId &&
        gh(
          [
            'api',
            `repos/${repo}/pulls/${pr}/comments/${thread.firstCommentId}/replies`,
            '--method',
            'POST',
            '--input',
            '-',
          ],
          JSON.stringify({
            body: `No longer reported as of \`${flags.head.slice(0, 7)}\`; this thread can be resolved.`,
          }),
        ),
    );
  }

  if (plan.relabel) {
    const args = ['pr', 'edit', pr, '--repo', repo];
    for (const l of plan.relabel.add) args.push('--add-label', l);
    for (const l of plan.relabel.remove) args.push('--remove-label', l);
    tryAct(`relabel: +${plan.relabel.add} -${plan.relabel.remove}`, () =>
      gh(args),
    );
  }
  if (warnings.length)
    say(
      `${warnings.length} action(s) could not be completed; the verdict stands`,
    );

  if (process.env.GITHUB_OUTPUT && !dryRun) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `outcome=${plan.outcome}\nverdict=${plan.verdict ?? ''}\nfail=${plan.failCheck}\n`,
    );
  }
  if (dryRun) {
    const p = join(tmpdir(), 'review-publish-plan.json');
    writeFileSync(p, JSON.stringify(plan, null, 2));
    say(`plan written to ${p}`);
  }
  say(
    `${plan.outcome}; verdict ${plan.verdict ?? 'none'}; check ${plan.failCheck ? 'fails' : 'passes'}`,
  );
};

const firstLine = (err) =>
  String(err.stderr || err.message || err)
    .split('\n')
    .find(Boolean) ?? 'unknown error';

if (isMain(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    cannotRun('review-publish')(firstLine(err));
  }
}
