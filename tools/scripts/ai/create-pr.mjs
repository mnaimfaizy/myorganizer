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
    .filter(Boolean);
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

function getBranchCommitSubjects(baseBranch) {
  const baseRef = resolveBaseRef(baseBranch);
  const mergeBase = trimStdout('git', ['merge-base', baseRef, 'HEAD']);
  const logOutput = trimStdout('git', [
    'log',
    '--format=%s',
    '--reverse',
    `${mergeBase}..HEAD`,
  ]);

  return logOutput
    .split('\n')
    .map((subject) => subject.trim())
    .filter(Boolean);
}

function buildFallbackTitle(commitSubjects, branch) {
  if (commitSubjects.length === 1) {
    return commitSubjects[0];
  }

  const normalizedBranch = branch.replace(/[\/_-]+/g, ' ').trim();
  return normalizedBranch ? `Update ${normalizedBranch}` : commitSubjects[0];
}

function buildFallbackBody(commitSubjects, baseBranch) {
  const summaryLines = commitSubjects
    .map((subject) => `- ${subject}`)
    .join('\n');

  return [
    '## Summary',
    summaryLines,
    '',
    '## Validation',
    `- Derived from commits targeting ${baseBranch}.`,
  ].join('\n');
}

function readBody(options, commitSubjects, branch, baseBranch) {
  if (options.body && options.bodyFile) {
    fail('Provide either --body or --body-file, not both.');
  }

  if (options.bodyFile) {
    return options.bodyFile;
  }

  const bodyText =
    options.body ?? buildFallbackBody(commitSubjects, baseBranch);
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
    'number,url',
  ]);

  if (!response) {
    return null;
  }

  const pullRequests = JSON.parse(response);
  return pullRequests[0] ?? null;
}

function updateExistingPullRequest(pullRequestNumber, assignee, reviewers) {
  const editArgs = [
    'pr',
    'edit',
    String(pullRequestNumber),
    '--add-assignee',
    assignee,
  ];

  reviewers.forEach((reviewer) => {
    editArgs.push('--add-reviewer', reviewer);
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

ensureNotBaseBranch(branch, baseBranch);
ensureUpstreamBranch();

const assignee = getAuthenticatedLogin();
const existingPullRequest = findExistingPullRequest(branch, baseBranch);

if (existingPullRequest) {
  updateExistingPullRequest(existingPullRequest.number, assignee, reviewers);
  process.stdout.write(`${existingPullRequest.url}\n`);
  process.exit(0);
}

const commitSubjects = getBranchCommitSubjects(baseBranch);

if (commitSubjects.length === 0) {
  fail(`No commits found between ${baseBranch} and ${branch}.`);
}

const title = options.title ?? buildFallbackTitle(commitSubjects, branch);
const bodySource = readBody(options, commitSubjects, branch, baseBranch);

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
