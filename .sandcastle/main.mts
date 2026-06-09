import { run, claudeCode } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'mnaimfaizy/myorganizer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(message: string, code = 1): never {
  console.error(`\nError: ${message}`);
  process.exit(code);
}

function ghJson<T>(args: string[]): T {
  const r = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true });
  if (r.error) fail(`gh error: ${r.error.message}`);
  if (r.status !== 0) fail(`gh failed: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout) as T;
}

function ghSilent(args: string[]): void {
  spawnSync('gh', args, { encoding: 'utf8', stdio: 'pipe', windowsHide: true });
}

function gitCmd(args: string[]): string {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  if (r.error) fail(`git error: ${r.error.message}`);
  if (r.status !== 0) fail(`git ${args.join(' ')} failed:\n${r.stderr.trim()}`);
  return r.stdout.trim();
}

// ─── Parse --prd <N> ─────────────────────────────────────────────────────────

const prdFlag = process.argv.indexOf('--prd');
if (prdFlag === -1 || !process.argv[prdFlag + 1]) {
  fail('Usage: yarn dispatch-agents --prd <issue-number>');
}
const prdNumber = parseInt(process.argv[prdFlag + 1], 10);
if (isNaN(prdNumber)) fail('--prd must be a number.');

// ─── Fetch PRD issue ──────────────────────────────────────────────────────────

type Issue = {
  number: number;
  title: string;
  labels: Array<{ name: string }>;
  body: string;
};

const prd = ghJson<Pick<Issue, 'title' | 'body'>>([
  'issue',
  'view',
  String(prdNumber),
  '--repo',
  REPO,
  '--json',
  'title,body',
]);

const featureName = prd.title.replace(/^\[PRD\]\s*/i, '').trim();
const featureSlug = featureName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const featureBranch = `feat/${featureSlug}`;

console.log(`\nPRD #${prdNumber}: ${featureName}`);
console.log(`Feature branch:  ${featureBranch}\n`);

// ─── Create feature branch on origin if missing ───────────────────────────────

gitCmd(['fetch', 'origin']);

const remoteBranchExists =
  spawnSync('git', ['ls-remote', '--exit-code', 'origin', featureBranch], {
    encoding: 'utf8',
    windowsHide: true,
  }).status === 0;

if (!remoteBranchExists) {
  console.log(`Creating ${featureBranch} from origin/main...`);
  const mainSha = gitCmd(['rev-parse', 'origin/main']);
  const create = spawnSync(
    'gh',
    [
      'api',
      `repos/${REPO}/git/refs`,
      '--method',
      'POST',
      '-f',
      `ref=refs/heads/${featureBranch}`,
      '-f',
      `sha=${mainSha}`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (create.status !== 0 && !create.stdout.includes('already_exists')) {
    fail(`Failed to create ${featureBranch}: ${create.stderr.trim()}`);
  }
  console.log(`Branch ${featureBranch} created.`);
}

// Fetch the feature branch from origin.
gitCmd(['fetch', 'origin', featureBranch]);
console.log(`Fetched ${featureBranch} from origin.`);

// Pre-create all slice branches locally from origin/<featureBranch> before
// dispatching. This lets sandcastle's first `git worktree add <path> <slice>`
// succeed directly — avoiding the fallback that tries to checkout featureBranch
// itself, which would only work for one worktree at a time (race condition).
// Branch creation is best-effort: ignore if already exists.

// ─── Fetch AFK slice issues for this PRD ─────────────────────────────────────

const allIssues = ghJson<Issue[]>([
  'issue',
  'list',
  '--repo',
  REPO,
  '--label',
  'ready-for-agent',
  '--label',
  'type:afk',
  '--state',
  'open',
  '--json',
  'number,title,labels,body',
  '--limit',
  '100',
]);

const slices = allIssues.filter((i) => i.body?.includes(`PRD: #${prdNumber}`));

if (slices.length === 0) {
  fail(
    `No open AFK slice issues found for PRD #${prdNumber}.\n` +
      `Run /to-issues ${prdNumber} to create them first.`,
  );
}

// ─── Linux node_modules cache ─────────────────────────────────────────────────
// We maintain a Linux-native node_modules at .sandcastle/node_modules_linux_cache/.
// It is seeded once via a short-lived Docker container and then BIND-MOUNTED into
// every agent container at /home/agent/workspace/node_modules. Agents call
// `yarn install --immutable` which exits in <5s (node_modules already present and
// correct for Linux). The cache is invalidated when yarn.lock changes.

const linuxNmCache = join(
  process.cwd(),
  '.sandcastle',
  'node_modules_linux_cache',
);
const cacheHashFile = join(linuxNmCache, '.cache-lockfile-hash');
const lockfilePath = join(process.cwd(), 'yarn.lock');

function lockfileHash(): string {
  return createHash('sha256')
    .update(readFileSync(lockfilePath))
    .digest('hex')
    .slice(0, 16);
}

function cacheIsValid(): boolean {
  if (!existsSync(join(linuxNmCache, '.yarn-state.yml'))) return false;
  if (!existsSync(cacheHashFile)) return false;
  return readFileSync(cacheHashFile, 'utf8').trim() === lockfileHash();
}

if (!cacheIsValid()) {
  console.log(
    'Linux node_modules cache missing or stale — seeding via Docker (one-time, ~10-15 min)...',
  );
  mkdirSync(linuxNmCache, { recursive: true });
  const hash = lockfileHash();
  const seed = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--entrypoint',
      '/bin/bash',
      '--user',
      '1000:1000',
      '-v',
      `${process.cwd()}:/home/agent/workspace`,
      '-v',
      `${linuxNmCache}:/home/agent/workspace/node_modules`,
      'sandcastle:myorganizer',
      '-c',
      `cd /home/agent/workspace && corepack yarn install 2>&1 && echo ${hash} > /home/agent/workspace/node_modules/.cache-lockfile-hash`,
    ],
    { encoding: 'utf8', stdio: 'inherit', windowsHide: true, timeout: 1800000 },
  );
  if (seed.status !== 0) {
    console.error(
      'Warning: cache seed failed — agents will run yarn install themselves (slow).',
    );
  } else {
    writeFileSync(cacheHashFile, hash);
    console.log('Linux node_modules cache ready.\n');
  }
} else {
  console.log(
    'Linux node_modules cache valid — agents start with node_modules pre-populated.\n',
  );
}

// Pre-create slice branches and worktrees so sandcastle reuses them on first try.
const worktreesDir = join(process.cwd(), '.sandcastle', 'worktrees');

for (const issue of slices) {
  const sb = sliceBranchFor(issue);

  // 1. Ensure local branch exists.
  const branchExists =
    spawnSync('git', ['rev-parse', '--verify', sb], {
      encoding: 'utf8',
      windowsHide: true,
    }).status === 0;
  if (!branchExists) {
    spawnSync('git', ['branch', sb, `origin/${featureBranch}`], {
      encoding: 'utf8',
      windowsHide: true,
    });
    console.log(`  Pre-created branch ${sb}`);
  }

  // 2. Ensure the worktree directory exists so sandcastle reuses it.
  const worktreeName = sb.replace(/\//g, '-');
  const worktreePath = join(worktreesDir, worktreeName);
  if (!existsSync(worktreePath)) {
    const wt = spawnSync('git', ['worktree', 'add', worktreePath, sb], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (wt.status !== 0) {
      console.error(
        `  Warning: could not create worktree for ${sb}: ${wt.stderr.trim()}`,
      );
    } else {
      console.log(`  Pre-created worktree  ${worktreeName}`);
    }
  }
}
console.log();

console.log(`Dispatching ${slices.length} slice(s) in parallel...\n`);

// ─── Model routing ────────────────────────────────────────────────────────────

function modelFor(issue: Issue): string {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes('complexity:high')) return 'claude-opus-4-5';
  if (labels.includes('complexity:medium')) return 'claude-sonnet-4-6';
  return 'claude-haiku-4-5';
}

function sliceBranchFor(issue: Issue): string {
  const slug = issue.title
    .replace(/^\[Slice\]\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `slice/${issue.number}-${slug}`;
}

function buildPrompt(issue: Issue, sliceBranch: string): string {
  return [
    `You are implementing GitHub Issue #${issue.number}: ${issue.title}`,
    ``,
    `## Issue`,
    ``,
    issue.body,
    ``,
    `## Instructions`,
    ``,
    `- Run \`corepack yarn install --immutable\` as your first step (expect ~3 min — node_modules is pre-seeded with Linux-native binaries so no compilation occurs, but yarn still fetches and links). Do not skip or interrupt this step.`,
    `- Read CLAUDE.md, CONTEXT.md, and TECH_STACK.md before making any changes.`,
    `- Implement this vertical slice end-to-end (schema → API → UI → tests where applicable).`,
    `- Your working branch is \`${sliceBranch}\` (based on \`${featureBranch}\`). Do not switch branches.`,
    `- Follow all mandatory delegation rules in CLAUDE.md (tests → TestScaffold, components → ComponentBuilder, etc.).`,
    `- Commit your changes using Conventional Commit messages (\`corepack yarn ai:commit\`).`,
    `- When implementation is complete, output <promise>COMPLETE</promise>.`,
  ].join('\n');
}

// ─── Dispatch all slices in parallel ─────────────────────────────────────────

type SliceResult = {
  issue: Issue;
  sliceBranch: string;
  prUrl: string;
  commits: number;
};

const results = await Promise.allSettled<SliceResult>(
  slices.map(async (issue): Promise<SliceResult> => {
    const model = modelFor(issue);
    const sliceBranch = sliceBranchFor(issue);

    console.log(`  → #${issue.number} on ${sliceBranch} (${model})`);

    ghSilent([
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      REPO,
      '--add-label',
      'status:in-progress',
    ]);

    const result = await run({
      agent: claudeCode(model),
      sandbox: docker({
        env: {
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_SKIP_NX_CACHE: 'true',
        },
        // Mount the pre-seeded Linux node_modules cache over the worktree's
        // node_modules directory. This gives agents a working Linux-native
        // node_modules instantly — `yarn install --immutable` exits in <5s.
        mounts: [
          {
            hostPath: '.sandcastle/node_modules_linux_cache',
            sandboxPath: 'node_modules',
          },
        ],
      }),
      name: `#${issue.number}`,
      branchStrategy: {
        type: 'branch',
        branch: sliceBranch,
        baseBranch: featureBranch,
      },
      maxIterations: 25,
      prompt: buildPrompt(issue, sliceBranch),
    });

    // Update labels
    ghSilent([
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      REPO,
      '--remove-label',
      'status:in-progress',
      '--add-label',
      'status:done',
    ]);

    // Create PR from slice branch → feature branch
    const prCreate = spawnSync(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        REPO,
        '--head',
        sliceBranch,
        '--base',
        featureBranch,
        '--title',
        issue.title,
        '--body',
        `Closes #${issue.number}\n\nPart of \`${featureBranch}\` — see PRD #${prdNumber}.`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );

    const prUrl =
      prCreate.status === 0
        ? prCreate.stdout.trim()
        : `(PR creation failed: ${prCreate.stderr.trim().slice(0, 80)})`;

    // Post completion comment on issue
    ghSilent([
      'issue',
      'comment',
      String(issue.number),
      '--repo',
      REPO,
      '--body',
      `Agent completed. ${result.commits.length} commit(s) on \`${sliceBranch}\`.\nPR: ${prUrl}`,
    ]);

    return { issue, sliceBranch, prUrl, commits: result.commits.length };
  }),
);

// ─── Summary ─────────────────────────────────────────────────────────────────

const succeeded = results.filter(
  (r): r is PromiseFulfilledResult<SliceResult> => r.status === 'fulfilled',
);
const failed = results.filter(
  (r): r is PromiseRejectedResult => r.status === 'rejected',
);

console.log(`\n${'─'.repeat(55)}`);
console.log(
  `Batch done: ${succeeded.length} succeeded, ${failed.length} failed.\n`,
);

for (const r of succeeded) {
  console.log(`  ✓ #${r.value.issue.number} — ${r.value.prUrl}`);
}
for (const r of failed) {
  console.error(`  ✗ ${String(r.reason)}`);
}

if (succeeded.length > 0) {
  console.log(`\nNext step: review slice PRs targeting \`${featureBranch}\`,`);
  console.log(`then open a final PR from \`${featureBranch}\` to \`main\`.`);
}

// ─── Desktop notification (Windows) ──────────────────────────────────────────

const safeTitle = featureName.replace(/'/g, "''");
spawnSync(
  'powershell.exe',
  [
    '-Command',
    [
      'Add-Type -AssemblyName System.Windows.Forms;',
      `[System.Windows.Forms.MessageBox]::Show(`,
      `  '${succeeded.length} agent(s) done, ${failed.length} failed.` +
        `\\nPRD #${prdNumber}: ${safeTitle}',`,
      `  'dispatch-agents complete', 'OK', 'Information'`,
      `)`,
    ].join(' '),
  ],
  { windowsHide: true },
);
