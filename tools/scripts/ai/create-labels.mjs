#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const REPO = 'mnaimfaizy/myorganizer';

const LABELS = [
  {
    name: 'ready-for-agent',
    color: '0075ca',
    description:
      'Orchestrator may pick this issue up for autonomous processing',
  },
  {
    name: 'complexity:low',
    color: 'c5def5',
    description: 'Route to Haiku — simple, well-scoped task',
  },
  {
    name: 'complexity:medium',
    color: 'bfd4f2',
    description: 'Route to Sonnet — moderate complexity task',
  },
  {
    name: 'complexity:high',
    color: '84b6eb',
    description: 'Route to Opus — complex task requiring deep reasoning',
  },
  {
    name: 'type:afk',
    color: 'e4e669',
    description: 'Agent can implement and merge without human interaction',
  },
  {
    name: 'type:hitl',
    color: 'f9d0c4',
    description:
      'Human decision required before agent can proceed — skipped by dispatch-agents',
  },
  {
    name: 'status:in-progress',
    color: 'fef2c0',
    description: 'Agent has picked up the issue and is working on it',
  },
  {
    name: 'status:done',
    color: '0e8a16',
    description:
      'Agent finished; slice integrated into the local feature branch',
  },
  {
    name: 'prd',
    color: '6f42c1',
    description:
      'Product Requirements Document — parent issue for a planned feature',
  },
];

function run(args) {
  return spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  });
}

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

const results = { created: [], skipped: [], failed: [] };

for (const label of LABELS) {
  const result = run([
    'api',
    `repos/${REPO}/labels`,
    '--method',
    'POST',
    '--field',
    `name=${label.name}`,
    '--field',
    `color=${label.color}`,
    '--field',
    `description=${label.description}`,
  ]);

  if (result.status === 0) {
    results.created.push(label.name);
    process.stdout.write(`  created  ${label.name}\n`);
    continue;
  }

  const isAlreadyExists =
    result.stderr.includes('already_exists') ||
    result.stdout.includes('already_exists') ||
    (result.status === 1 && result.stderr.includes('422'));

  if (isAlreadyExists) {
    results.skipped.push(label.name);
    process.stdout.write(`  exists   ${label.name}\n`);
    continue;
  }

  results.failed.push(label.name);
  process.stderr.write(`  FAILED   ${label.name}\n`);
  process.stderr.write(`           ${result.stderr.trim()}\n`);
}

process.stdout.write(
  `\nDone. ${results.created.length} created, ${results.skipped.length} already existed, ${results.failed.length} failed.\n`,
);

if (results.failed.length > 0) {
  fail(`\nFailed to create labels: ${results.failed.join(', ')}`);
}
