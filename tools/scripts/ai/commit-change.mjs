#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const usage = `Usage:
  corepack yarn ai:commit --message "type(scope): subject"
  corepack yarn ai:commit --message-file path/to/message.txt
  cat message.txt | corepack yarn ai:commit

Options:
  --message <text>       Commit message text to use.
  --message-file <path>  Read the commit message from a file.
  --help                 Show this help text.
`;

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    help: false,
    message: null,
    messageFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--message') {
      options.message = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === '--message-file') {
      options.messageFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    fail(`Failed to run ${command}: ${result.error.message}`);
  }

  return result;
}

function readCommitMessage(options) {
  if (options.message && options.messageFile) {
    fail('Provide either --message or --message-file, not both.');
  }

  if (options.messageFile) {
    return readFileSync(options.messageFile, 'utf8');
  }

  if (options.message) {
    return options.message;
  }

  if (!process.stdin.isTTY) {
    return readFileSync(0, 'utf8');
  }

  fail(
    'A commit message is required. Use --message, --message-file, or stdin.',
  );
}

function ensureStagedChanges() {
  const result = run('git', ['diff', '--cached', '--quiet', '--exit-code']);

  if (result.status === 1) {
    return;
  }

  if (result.status === 0) {
    fail(
      'No staged changes found. Stage the intended files before running ai:commit.',
    );
  }

  fail('Unable to inspect staged changes before committing.');
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  process.stdout.write(usage);
  process.exit(0);
}

const commitMessage = readCommitMessage(options).trimEnd();

if (!commitMessage.trim()) {
  fail('Commit message cannot be empty.');
}

ensureStagedChanges();

const tempDir = mkdtempSync(join(tmpdir(), 'myorganizer-ai-commit-'));
const messagePath = join(tempDir, 'COMMIT_EDITMSG');

writeFileSync(messagePath, `${commitMessage}\n`, 'utf8');

const commitResult = run('git', ['commit', '--file', messagePath]);

rmSync(tempDir, { force: true, recursive: true });

if (typeof commitResult.status === 'number') {
  process.exit(commitResult.status);
}

process.exit(1);
