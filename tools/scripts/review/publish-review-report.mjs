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
//   - edits the one sticky summary comment in place (or creates it)
//   - posts an inline comment for each blocking finding with a location,
//     once per finding id
//   - relabels the Pull Request when the verdict or the effective tier says
//     it must be human
//
// Exit 0 = posted (even when the verdict is request-changes: the workflow
// reads `verdict=` from $GITHUB_OUTPUT and fails the check itself).
// Exit 2 = could not run or could not post.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import { STICKY_MARKER, planPublication } from './publish.mjs';

const gh = (args, input) => {
  const opts = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
  if (input !== undefined) opts.input = input;
  return execFileSync('gh', args, opts);
};
const ghJson = (args, input) => JSON.parse(gh(args, input) || 'null');

export const main = (argv) => {
  const bail = cannotRun('review-publish');
  const { flags } = parseArgs(argv);
  for (const k of ['pr', 'repo', 'head', 'run-url'])
    if (!flags[k]) bail(`--${k} is required`);
  const dryRun = 'dry-run' in flags;
  const repo = flags.repo;
  const pr = flags.pr;

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

  const prView = ghJson([
    'pr',
    'view',
    pr,
    '--repo',
    repo,
    '--json',
    'labels,headRefOid',
  ]);
  const currentLabels = prView.labels.map((l) => l.name);
  const issueComments = ghJson([
    'api',
    `repos/${repo}/issues/${pr}/comments`,
    '--paginate',
    '--slurp',
  ]).flat();
  const reviewComments = ghJson([
    'api',
    `repos/${repo}/pulls/${pr}/comments`,
    '--paginate',
    '--slurp',
  ]).flat();

  const plan = planPublication({
    normalized,
    rendered,
    rejectedReason,
    tier: flags.tier ?? null,
    headSha: flags.head,
    runUrl: flags['run-url'],
    currentLabels,
    existingReviewBodies: reviewComments.map((c) => c.body ?? ''),
  });

  const sticky = issueComments.find((c) =>
    (c.body ?? '').includes(STICKY_MARKER),
  );
  const say = (msg) =>
    console.log(`review-publish: ${dryRun ? '[dry-run] ' : ''}${msg}`);

  if (dryRun) {
    say(
      `would ${sticky ? 'update' : 'create'} the summary comment (${plan.summary.length} chars)`,
    );
  } else if (sticky) {
    gh(
      [
        'api',
        `repos/${repo}/issues/comments/${sticky.id}`,
        '--method',
        'PATCH',
        '--input',
        '-',
      ],
      JSON.stringify({ body: plan.summary }),
    );
    say(`updated summary comment ${sticky.id}`);
  } else {
    const created = ghJson(
      [
        'api',
        `repos/${repo}/issues/${pr}/comments`,
        '--method',
        'POST',
        '--input',
        '-',
      ],
      JSON.stringify({ body: plan.summary }),
    );
    say(`created summary comment ${created.id}`);
  }

  if (plan.inline.length) {
    const comments = plan.inline.map((c) => ({
      path: c.path,
      line: c.line,
      side: 'RIGHT',
      ...(c.startLine ? { start_line: c.startLine, start_side: 'RIGHT' } : {}),
      body: c.body,
    }));
    if (dryRun) {
      say(
        `would post ${comments.length} inline comment(s): ${plan.inline.map((c) => `${c.path}:${c.line}`).join(', ')}`,
      );
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
        say(`posted ${comments.length} inline comment(s)`);
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

  if (plan.relabel) {
    const args = ['pr', 'edit', pr, '--repo', repo];
    for (const l of plan.relabel.add) args.push('--add-label', l);
    for (const l of plan.relabel.remove) args.push('--remove-label', l);
    if (dryRun)
      say(`would relabel: +${plan.relabel.add} -${plan.relabel.remove}`);
    else {
      gh(args);
      say(`relabelled: +${plan.relabel.add} -${plan.relabel.remove}`);
    }
  }

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
