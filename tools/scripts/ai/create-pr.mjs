#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const usage = `Usage:
  corepack yarn ai:create-pr [options]

Options:
  --base <branch>         Base branch for the pull request. Defaults to origin/HEAD or main.
  --title <text>          Pull request title. Falls back to commit-derived text when omitted.
  --body <text>           Pull request body text.
  --body-file <path>      Read the pull request body from a file.
  --reviewer <login>      Reviewer to request. Repeat the flag or pass a comma-separated list.
  --draft                 Create the pull request as a draft.
  --help                  Show this help text.
`;

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    base: null,
    body: null,
    bodyFile: null,
    draft: false,
    help: false,
    reviewers: [],
    title: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--base') {
      options.base = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--title') {
      options.title = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--body') {
      options.body = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--body-file') {
      options.bodyFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--reviewer') {
      options.reviewers.push(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--draft') {
      options.draft = true;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function run(command, args, options = {}) {
  const { allowFailure = false } = options;
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  });

  if (result.error) {
    fail(`Failed to run ${command}: ${result.error.message}`);
  }

  if (!allowFailure && result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.status ?? 1);
  }

  return result;
}

function trimStdout(command, args, options = {}) {
  return run(command, args, options).stdout.trim();
}

function normalizeReviewers(reviewers) {
  return reviewers
    .flatMap((reviewer) => reviewer.split(','))
    .map((reviewer) => reviewer.trim())
    .filter(Boolean)
    .map((reviewer) => {
      if (reviewer.startsWith('@') && !/^@(copilot|me)$/i.test(reviewer)) {
        return reviewer.slice(1);
      }

      return reviewer;
    });
}

function validateReviewers(reviewers) {
  const unsupportedReviewers = reviewers.filter((reviewer) =>
    /^@(copilot|me)$/i.test(reviewer),
  );

  if (unsupportedReviewers.length === 0) {
    return;
  }

  fail(
    'GitHub review requests do not support @copilot or @me as reviewer handles through this workflow. Use a real GitHub login for --reviewer, or keep Copilot in the IDE/web review flow instead.',
  );
}

function ensureGhAvailable() {
  run('gh', ['--version']);
}

function getCurrentBranch() {
  const branch = trimStdout('git', ['branch', '--show-current']);

  if (!branch) {
    fail('Unable to determine the current branch.');
  }

  return branch;
}

function getDefaultBaseBranch() {
  const result = run('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
    allowFailure: true,
  });

  if (result.status === 0) {
    return result.stdout.trim().replace(/^refs\/remotes\/origin\//, '');
  }

  return 'main';
}

function ensureNotBaseBranch(branch, baseBranch) {
  if (branch === baseBranch) {
    fail(
      `Refusing to create a pull request from the base branch '${baseBranch}'.`,
    );
  }
}

function ensureUpstreamBranch() {
  const upstreamResult = run(
    'git',
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    { allowFailure: true },
  );

  if (upstreamResult.status === 0) {
    const aheadBehind = trimStdout('git', [
      'rev-list',
      '--left-right',
      '--count',
      '@{u}...HEAD',
    ]);
    const [behindCountText = '0', aheadCountText = '0'] =
      aheadBehind.split(/\s+/);
    const behindCount = Number.parseInt(behindCountText, 10);
    const aheadCount = Number.parseInt(aheadCountText, 10);

    if (Number.isInteger(aheadCount) && aheadCount > 0) {
      run('git', ['push', 'origin', 'HEAD']);
    }

    if (Number.isInteger(behindCount) && behindCount > 0 && aheadCount === 0) {
      fail(
        'The local branch is behind its upstream branch. Pull or rebase before creating the PR.',
      );
    }

    return;
  }

  run('git', ['push', '-u', 'origin', 'HEAD']);
}

function resolveBaseRef(baseBranch) {
  const remoteRef = `refs/remotes/origin/${baseBranch}`;
  const remoteCheck = run('git', ['rev-parse', '--verify', remoteRef], {
    allowFailure: true,
  });

  if (remoteCheck.status === 0) {
    return `origin/${baseBranch}`;
  }

  return baseBranch;
}

function getBranchCommits(baseBranch) {
  const baseRef = resolveBaseRef(baseBranch);
  const mergeBase = trimStdout('git', ['merge-base', baseRef, 'HEAD']);
  const logOutput = trimStdout('git', [
    'log',
    '--format=%s%x1f%b%x1e',
    '--reverse',
    `${mergeBase}..HEAD`,
  ]);

  return logOutput
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject = '', body = ''] = record.split('\x1f');

      return {
        body: body.trim(),
        subject: subject.trim(),
      };
    })
    .filter((commit) => Boolean(commit.subject));
}

function stripConventionalPrefix(subject) {
  return subject.replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '').trim();
}

function toSentence(text) {
  if (!text) {
    return '';
  }

  const normalizedText = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  return /[.!?]$/.test(normalizedText) ? normalizedText : `${normalizedText}.`;
}

function extractCommitBodyBullets(body) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

function buildFallbackWhy(commits, branch, baseBranch) {
  const primaryIntent = toSentence(stripConventionalPrefix(commits[0].subject));

  if (commits.length === 1) {
    return primaryIntent;
  }

  const followUpLabel =
    commits.length === 2 ? 'A follow-up commit' : 'Follow-up commits';

  return [
    primaryIntent,
    `${followUpLabel} refine the branch before merging \`${branch}\` into \`${baseBranch}\`.`,
  ].join(' ');
}

function buildFallbackTitle(commits, branch) {
  const commitSubjects = commits.map((commit) => commit.subject);

  if (commitSubjects.length >= 1) {
    return commitSubjects[0];
  }

  const normalizedBranch = branch.replace(/[/_-]+/g, ' ').trim();
  return normalizedBranch ? `Update ${normalizedBranch}` : commitSubjects[0];
}

function buildFallbackBody(commits, branch, baseBranch) {
  const detailBullets = commits.flatMap((commit) =>
    extractCommitBodyBullets(commit.body),
  );

  const changeLines =
    detailBullets.length > 0
      ? detailBullets.map((detail) => `- ${detail}`)
      : commits.map((commit) => `- ${commit.subject}`);

  return [
    '## Why',
    buildFallbackWhy(commits, branch, baseBranch),
    '',
    '## Changes',
    ...changeLines,
    '',
    '## Validation',
    `- Generated from ${commits.length} commit(s) on \`${branch}\`.`,
    `- Compared against base branch \`${baseBranch}\`.`,
  ].join('\n');
}

function readBody(options, commits, branch, baseBranch) {
  if (options.body && options.bodyFile) {
    fail('Provide either --body or --body-file, not both.');
  }

  if (options.bodyFile) {
    return options.bodyFile;
  }

  const bodyText =
    options.body ?? buildFallbackBody(commits, branch, baseBranch);
  const tempDir = mkdtempSync(join(tmpdir(), 'myorganizer-ai-pr-'));
  const bodyPath = join(
    tempDir,
    `${branch.replace(/[^a-zA-Z0-9_-]/g, '-')}-body.md`,
  );

  writeFileSync(bodyPath, `${bodyText.trimEnd()}\n`, 'utf8');

  return { bodyPath, tempDir };
}

function getAuthenticatedLogin() {
  const login = trimStdout('gh', ['api', 'user', '--jq', '.login']);

  if (!login) {
    fail('Unable to resolve the authenticated GitHub user.');
  }

  return login;
}

function findExistingPullRequest(branch, baseBranch) {
  const response = trimStdout('gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--base',
    baseBranch,
    '--state',
    'open',
    '--json',
    'number,url,reviewRequests',
  ]);

  if (!response) {
    return null;
  }

  const pullRequests = JSON.parse(response);
  return pullRequests[0] ?? null;
}

function updateExistingPullRequest(
  pullRequest,
  assignee,
  reviewers,
  title,
  bodyPath,
) {
  const existingReviewers = (pullRequest.reviewRequests ?? [])
    .map((reviewRequest) => reviewRequest.login)
    .filter(Boolean);
  const reviewersToAdd = reviewers.filter(
    (reviewer) => !existingReviewers.includes(reviewer),
  );
  const reviewersToRemove = existingReviewers.filter(
    (reviewer) => !reviewers.includes(reviewer),
  );
  const editArgs = [
    'pr',
    'edit',
    String(pullRequest.number),
    '--title',
    title,
    '--body-file',
    bodyPath,
    '--add-assignee',
    assignee,
  ];

  reviewersToAdd.forEach((reviewer) => {
    editArgs.push('--add-reviewer', reviewer);
  });

  reviewersToRemove.forEach((reviewer) => {
    editArgs.push('--remove-reviewer', reviewer);
  });

  run('gh', editArgs);
}

function createPullRequest(
  branch,
  baseBranch,
  assignee,
  reviewers,
  title,
  bodyPath,
  draft,
) {
  const args = [
    'pr',
    'create',
    '--base',
    baseBranch,
    '--head',
    branch,
    '--title',
    title,
    '--body-file',
    bodyPath,
    '--assignee',
    assignee,
  ];

  if (draft) {
    args.push('--draft');
  }

  reviewers.forEach((reviewer) => {
    args.push('--reviewer', reviewer);
  });

  const result = run('gh', args);
  const urls = result.stdout.match(/https?:\/\/\S+/g) ?? [];
  const pullRequestUrl = urls.at(-1)?.trim();

  if (!pullRequestUrl) {
    fail(
      'Pull request creation succeeded, but no pull request URL was returned.',
    );
  }

  return pullRequestUrl;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(usage);
  process.exit(0);
}

ensureGhAvailable();

const branch = getCurrentBranch();
const baseBranch = options.base ?? getDefaultBaseBranch();
const reviewers = normalizeReviewers(options.reviewers);
const commits = getBranchCommits(baseBranch);

ensureNotBaseBranch(branch, baseBranch);
validateReviewers(reviewers);
ensureUpstreamBranch();

if (commits.length === 0) {
  fail(`No commits found between ${baseBranch} and ${branch}.`);
}

const title = options.title ?? buildFallbackTitle(commits, branch);
const bodySource = readBody(options, commits, branch, baseBranch);

const assignee = getAuthenticatedLogin();
const existingPullRequest = findExistingPullRequest(branch, baseBranch);

if (existingPullRequest) {
  if (typeof bodySource === 'string') {
    updateExistingPullRequest(
      existingPullRequest,
      assignee,
      reviewers,
      title,
      bodySource,
    );
    process.stdout.write(`${existingPullRequest.url}\n`);
    process.exit(0);
  }

  try {
    updateExistingPullRequest(
      existingPullRequest,
      assignee,
      reviewers,
      title,
      bodySource.bodyPath,
    );
  } finally {
    rmSync(bodySource.tempDir, { force: true, recursive: true });
  }

  process.stdout.write(`${existingPullRequest.url}\n`);
  process.exit(0);
}

if (typeof bodySource === 'string') {
  const pullRequestUrl = createPullRequest(
    branch,
    baseBranch,
    assignee,
    reviewers,
    title,
    bodySource,
    options.draft,
  );
  process.stdout.write(`${pullRequestUrl}\n`);
  process.exit(0);
}

try {
  const pullRequestUrl = createPullRequest(
    branch,
    baseBranch,
    assignee,
    reviewers,
    title,
    bodySource.bodyPath,
    options.draft,
  );
  process.stdout.write(`${pullRequestUrl}\n`);
} finally {
  rmSync(bodySource.tempDir, { force: true, recursive: true });
}
