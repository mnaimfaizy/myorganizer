import { run, claudeCode } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { spawnSync } from 'node:child_process';

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
  console.log(`Branch ${featureBranch} created.\n`);
} else {
  console.log(`Branch ${featureBranch} already exists.\n`);
}

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
    `- Run \`corepack yarn install --immutable\` before making any changes.`,
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
      sandbox: docker(),
      name: `#${issue.number}`,
      branchStrategy: {
        type: 'branch',
        branch: sliceBranch,
        baseBranch: featureBranch,
      },
      maxIterations: 10,
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
