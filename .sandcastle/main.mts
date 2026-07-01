import dotenv from 'dotenv';
import { run, claudeCode, cursor, copilot } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'mnaimfaizy/myorganizer';

dotenv.config({ path: join(process.cwd(), '.sandcastle', '.env') });

// ─── Integration model (local-only) ───────────────────────────────────────────
// GitHub coupling is deliberately minimal: we READ the PRD + slice issues and
// WRITE status labels + a completion comment back to each slice. That is all.
//
// Everything else is LOCAL:
//   • The feature branch `feat/<slug>` is created from origin/main and is NEVER
//     pushed. It lives only in this clone until you push it by hand.
//   • Slices run ONE BY ONE. Each branches off the CURRENT local feature head, so
//     a slice sees every previously-merged slice's work. The agent commits inside
//     its sandbox; the host fast-forwards the local feature branch onto the slice.
//   • No per-slice push, no per-slice PR, no `gh pr merge`.
//
// After the run you QA the local feature branch, then push it and open ONE PR to
// `main` yourself — CI runs there. See docs/adr/0010 and docs/sandcastle/RUNBOOK.md.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(message: string, code = 1): never {
  console.error(`\nError: ${message}`);
  process.exit(code);
}

/**
 * Maps the files a slice changed (between base and head) to the Nx projects that
 * OWN them — the project rooted at the nearest ancestor `project.json` for each
 * file. Unlike `nx show projects --affected`, this excludes transitive dependents:
 * a change to shared `vault-core` returns only `vault-core` (+ any other project
 * whose own files changed), NOT every web page that imports it. This is the
 * correct scope for a LINT gate, where lint is per-file and an upstream change
 * cannot introduce lint errors in unchanged downstream files.
 */
function changedProjects(base: string, head: string): string[] {
  // Three-dot range: diff the slice head against the MERGE-BASE, i.e. only the
  // files the slice itself introduced — not files where the slice is merely
  // behind an advanced base.
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const files = (diff.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const names = new Set<string>();
  for (const file of files) {
    // Walk up the path segments looking for the nearest project.json.
    const segments = file.split('/');
    for (let i = segments.length - 1; i > 0; i--) {
      const dir = segments.slice(0, i).join('/');
      const pjPath = join(process.cwd(), dir, 'project.json');
      if (existsSync(pjPath)) {
        try {
          const pj = JSON.parse(readFileSync(pjPath, 'utf8')) as {
            name?: string;
          };
          if (pj.name) names.add(pj.name);
        } catch {
          /* ignore unparseable project.json */
        }
        break;
      }
    }
  }
  return [...names];
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

/** True if the git ref resolves locally (branch, remote-tracking ref, or sha). */
function gitRefExists(ref: string): boolean {
  return (
    spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
      encoding: 'utf8',
      windowsHide: true,
    }).status === 0
  );
}

// ─── Parse --prd <N> ─────────────────────────────────────────────────────────

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) return withEquals.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;

  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function printHelp(): void {
  console.log(`
Usage:
  yarn dispatch-agents --prd <issue-number> [--agent claude|cursor|copilot] [--model <model>]

Flags:
  --prd <issue-number>   PRD issue number to dispatch
  --agent <name>         Agent provider to use (default: SANDCASTLE_AGENT or claude)
  --model <model>        Override the model for this run (default: env/provider routing)
  --help                 Show this help text

Environment:
  .sandcastle/.env is loaded automatically.
  SANDCASTLE_AGENT
  SANDCASTLE_MODEL
  SANDCASTLE_CLAUDE_MODEL
  SANDCASTLE_CURSOR_MODEL
  SANDCASTLE_COPILOT_MODEL
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

const prdValue = getArgValue('prd');
if (!prdValue) {
  fail(
    'Usage: yarn dispatch-agents --prd <issue-number> [--agent claude|cursor|copilot] [--model <model>]',
  );
}

const prdNumber = parseInt(prdValue, 10);
if (isNaN(prdNumber)) fail('--prd must be a number.');

const agentFlag = getArgValue('agent');
const modelFlag = getArgValue('model');

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
console.log(`Feature branch:  ${featureBranch} (local only — never pushed)\n`);

// ─── Ensure the feature branch exists LOCALLY (never pushed) ───────────────────
// The PRD branch is created once, locally, from the freshest main. It is the
// integration target for every slice in this PRD. We do NOT create it on origin
// and we do NOT push it — you push it by hand after QA to open the PRD PR.

gitCmd(['fetch', 'origin', 'main']);

if (gitRefExists(featureBranch)) {
  console.log(`Reusing existing local branch ${featureBranch}.`);
} else {
  const base = gitRefExists('origin/main') ? 'origin/main' : 'main';
  gitCmd(['branch', featureBranch, base]);
  console.log(
    `Created local branch ${featureBranch} from ${base} (not pushed).`,
  );
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

const slices = allIssues.filter(
  (i) =>
    i.body?.includes(`PRD: #${prdNumber}`) &&
    // Skip slices already merged into the feature branch so re-runs are
    // idempotent — only undone work in the wave is re-dispatched.
    !i.labels.some((l) => l.name === 'status:done'),
);

if (slices.length === 0) {
  fail(
    `No open AFK slice issues found for PRD #${prdNumber}.\n` +
      `Run /to-issues ${prdNumber} to create them first.`,
  );
}

// ─── Dependency install model ─────────────────────────────────────────────────
// Each slice's node_modules is installed INSIDE the Linux container by a
// `hooks.sandbox.onSandboxReady` hook that runs `corepack yarn install --immutable`
// before the agent starts (see the run() call below). Installing in-container means
// the native binaries (bcrypt, prisma, @swc/core) are always built for the
// container's platform — so dispatch works correctly on WSL2, native Linux, AND
// macOS hosts (a host-side install would bake in the host's wrong-arch binaries).
//
// Yarn's global cache is bind-mounted from .sandcastle/.yarn-cache (host) into every
// container, so it survives across runs and is shared between slices. It is
// content-addressable, so it NEVER needs full invalidation. Repeat installs are
// incremental.
//
// The ONLY environment requirement: the worktree must live on a NATIVE filesystem
// (ext4 on Linux/WSL2, APFS on macOS) — NOT a Windows-mounted path (/mnt/d, drvfs),
// where the same install takes ~29 min instead of ~2 min. On Windows that means
// running dispatch from inside WSL2 with the repo on ext4. See docs/adr/0009 and
// docs/sandcastle/RUNBOOK.md.

// Shared, content-addressable Yarn global cache, bind-mounted into every agent and
// gate container at /home/agent/.yarn-cache (see YARN_GLOBAL_FOLDER below). Created
// here so sandcastle's mount validation (which requires the host path to exist)
// passes on a fresh checkout.
const yarnCacheDir = join(process.cwd(), '.sandcastle', '.yarn-cache');
mkdirSync(yarnCacheDir, { recursive: true });

// Env that makes every container use the bind-mounted global cache.
const YARN_CACHE_ENV = {
  YARN_ENABLE_GLOBAL_CACHE: 'true',
  YARN_GLOBAL_FOLDER: '/home/agent/.yarn-cache',
} as const;

// Run the gate container as the host user so bind-mounted files (worktree, cache)
// stay owned by the dispatcher. Matches the AGENT_UID/GID baked into the image by
// sandcastle (host UID/GID at build). undefined on Windows, but dispatch runs on
// Linux/WSL2/macOS where these are defined.
const HOST_UID = process.getuid?.() ?? 1000;
const HOST_GID = process.getgid?.() ?? 1000;

const worktreesDir = join(process.cwd(), '.sandcastle', 'worktrees');

console.log(`Dispatching ${slices.length} slice(s) one by one...\n`);

// ─── Model routing ────────────────────────────────────────────────────────────

type AgentKind = 'claude' | 'cursor' | 'copilot';

function modelFor(issue: Issue): string {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes('complexity:high')) return 'claude-opus-4-5';
  if (labels.includes('complexity:medium')) return 'claude-sonnet-4-6';
  return 'claude-haiku-4-5';
}

function resolveAgentKind(): AgentKind {
  const raw = (agentFlag ?? process.env.SANDCASTLE_AGENT ?? 'claude').trim();
  if (raw === 'claude' || raw === 'cursor' || raw === 'copilot') {
    return raw;
  }

  fail(`Unknown agent "${raw}". Available: claude, cursor, copilot.`);
}

function resolveModel(issue: Issue, agentKind: AgentKind): string {
  const explicitModel = modelFlag ?? process.env.SANDCASTLE_MODEL;
  if (explicitModel) return explicitModel;

  switch (agentKind) {
    case 'claude':
      return process.env.SANDCASTLE_CLAUDE_MODEL ?? modelFor(issue);
    case 'cursor':
      return process.env.SANDCASTLE_CURSOR_MODEL ?? 'composer-2';
    case 'copilot':
      return process.env.SANDCASTLE_COPILOT_MODEL ?? 'claude-sonnet-4.5';
  }
}

function buildAgent(agentKind: AgentKind, model: string) {
  switch (agentKind) {
    case 'claude':
      return claudeCode(model);
    case 'cursor':
      return cursor(model);
    case 'copilot':
      return copilot(model);
  }
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

// ─── Finalize the agent's local commit ─────────────────────────────────────────
// Agents run in a credential-less sandbox and only commit locally on their slice
// branch. Their commit lands on the local slice-branch ref (shared .git), so there
// is nothing to push. This just captures any stray uncommitted changes the agent
// left (formatting, generated files) and confirms the slice actually produced work.
function finalizeSliceBranch(issue: Issue, sliceBranch: string): boolean {
  if (!gitRefExists(sliceBranch)) {
    console.error(
      `  [#${issue.number}] local branch ${sliceBranch} not found — nothing to integrate.`,
    );
    return false;
  }

  // If the agent's worktree survived AND has uncommitted changes, capture them.
  // --no-verify skips host husky hooks; the gate is the real check.
  const worktreePath = join(worktreesDir, sliceBranch.replace(/\//g, '-'));
  if (existsSync(worktreePath)) {
    const dirty = (
      spawnSync('git', ['-C', worktreePath, 'status', '--porcelain'], {
        encoding: 'utf8',
        windowsHide: true,
      }).stdout || ''
    ).trim();
    if (dirty) {
      spawnSync('git', ['-C', worktreePath, 'add', '-A'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      spawnSync(
        'git',
        [
          '-C',
          worktreePath,
          'commit',
          '--no-verify',
          '-m',
          `chore(slice): finalize #${issue.number} agent changes`,
        ],
        { encoding: 'utf8', windowsHide: true },
      );
    }
  }

  // Nothing ahead of the feature branch means the agent produced no work.
  const ahead = spawnSync(
    'git',
    ['rev-list', '--count', `${featureBranch}..${sliceBranch}`],
    { encoding: 'utf8', windowsHide: true },
  );
  if ((ahead.stdout || '').trim() === '0') {
    console.error(
      `  [#${issue.number}] ${sliceBranch} has no commits beyond ${featureBranch} — nothing to integrate.`,
    );
    return false;
  }
  return true;
}

// ─── Build gate ───────────────────────────────────────────────────────────────
// Before a slice is fast-forwarded into the LOCAL feature branch, lint its changed
// projects in a Docker container against the LOCAL slice branch. Fail closed: if the
// gate cannot run or does not pass, the slice is NOT integrated and NOT marked
// status:done, so we never stack later slices on broken code. Disable with
// SLICE_GATE=off.
function runSliceGate(issue: Issue, sliceBranch: string): boolean {
  if ((process.env.SLICE_GATE ?? '').toLowerCase() === 'off') {
    console.log(
      `  [#${issue.number}] gate disabled (SLICE_GATE=off) — integrating without verification.`,
    );
    return true;
  }

  const targets = (process.env.SLICE_GATE_TARGETS || 'lint').trim();
  const targetList = targets.split(/[\s,]+/).filter(Boolean);

  // Gate only the projects whose OWN files this slice changed — not their
  // transitive dependents. For a per-file lint gate, an upstream change cannot
  // introduce lint errors downstream.
  const projects = changedProjects(featureBranch, sliceBranch);
  if (projects.length === 0) {
    console.log(`  [#${issue.number}] gate: no project files changed — pass.`);
    return true;
  }

  // Gate in a DEDICATED detached worktree at the local slice commit. Detached + a
  // separate path means it never holds the slice branch checked out and it is
  // independent of sandcastle's own worktree lifecycle (which may already have
  // removed the agent's worktree).
  const gateName = sliceBranch.replace(/\//g, '-');
  const gateRoot = join(process.cwd(), '.sandcastle', 'gate');
  const gatePath = join(gateRoot, gateName);
  mkdirSync(gateRoot, { recursive: true });
  spawnSync('git', ['worktree', 'prune'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (existsSync(gatePath)) {
    spawnSync('git', ['worktree', 'remove', '--force', gatePath], {
      encoding: 'utf8',
      windowsHide: true,
    });
  }
  const add = spawnSync(
    'git',
    ['worktree', 'add', '--detach', gatePath, sliceBranch],
    { encoding: 'utf8', windowsHide: true },
  );
  if (add.status !== 0) {
    console.error(
      `  [#${issue.number}] gate: could not create gate worktree — failing closed.\n${add.stderr}`,
    );
    return false;
  }

  try {
    // Validate this slice INSIDE the Linux container (cross-platform: WSL2, native
    // Linux, and macOS hosts all work). Install the slice's EXACT tree in-container
    // — so the gate validates lock-changing slices correctly, with binaries matching
    // the container — then run nx. Shares the bind-mounted Yarn global cache, so the
    // install is incremental. Fail closed on any failure.
    console.log(
      `  [#${issue.number}] gate: installing + running '${targets}' on ${projects.join(', ')} ...`,
    );
    const gate = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--user',
        `${HOST_UID}:${HOST_GID}`,
        '-e',
        'HOME=/home/agent',
        '-e',
        'NX_DAEMON=false',
        '-e',
        'NX_ISOLATE_PLUGINS=false',
        '-e',
        'NX_SKIP_NX_CACHE=true',
        '-e',
        `YARN_ENABLE_GLOBAL_CACHE=${YARN_CACHE_ENV.YARN_ENABLE_GLOBAL_CACHE}`,
        '-e',
        `YARN_GLOBAL_FOLDER=${YARN_CACHE_ENV.YARN_GLOBAL_FOLDER}`,
        '-v',
        `${gatePath}:/home/agent/workspace`,
        '-v',
        `${yarnCacheDir}:/home/agent/.yarn-cache`,
        '--entrypoint',
        '/bin/bash',
        'sandcastle:myorganizer',
        '-c',
        `cd /home/agent/workspace && corepack yarn install --immutable && node node_modules/.bin/nx run-many -t ${targetList.join(' ')} --projects=${projects.join(',')} --skip-nx-cache`,
      ],
      {
        encoding: 'utf8',
        stdio: 'inherit',
        windowsHide: true,
        timeout: 1800000,
      },
    );

    const ok = gate.status === 0;
    console.log(`  [#${issue.number}] gate: ${ok ? 'PASS' : 'FAIL'}.`);
    return ok;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', gatePath], {
      encoding: 'utf8',
      windowsHide: true,
    });
  }
}

// ─── Integrate a slice into the local feature branch (fast-forward) ────────────
// Slices run serially, each branched off the current feature head, so the slice is
// always a pure descendant of the feature branch — a fast-forward, no merge commit,
// no conflicts. We advance the (un-checked-out) feature ref with `git branch -f`.
// Nothing is pushed. Fails closed if the slice is somehow not a descendant.
function integrateSlice(issue: Issue, sliceBranch: string): boolean {
  const isDescendant =
    spawnSync(
      'git',
      ['merge-base', '--is-ancestor', featureBranch, sliceBranch],
      { encoding: 'utf8', windowsHide: true },
    ).status === 0;
  if (!isDescendant) {
    console.error(
      `  [#${issue.number}] integrate: ${sliceBranch} is not a fast-forward of ${featureBranch} — failing closed (resolve by hand).`,
    );
    return false;
  }
  const ff = spawnSync('git', ['branch', '-f', featureBranch, sliceBranch], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (ff.status !== 0) {
    console.error(
      `  [#${issue.number}] integrate: failed to advance ${featureBranch}.\n${ff.stderr}`,
    );
    return false;
  }
  console.log(
    `  [#${issue.number}] integrated into local ${featureBranch} (fast-forward).`,
  );
  return true;
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
    `- Dependencies are ALREADY installed in this sandbox before you start (a setup hook runs \`corepack yarn install --immutable\`). Do NOT run \`yarn install\` yourself.`,
    `- Read CLAUDE.md, CONTEXT.md, and TECH_STACK.md before making any changes.`,
    `- Implement this vertical slice end-to-end (schema → API → UI → tests where applicable).`,
    `- Your working branch is \`${sliceBranch}\` (based on \`${featureBranch}\`). Do not switch branches.`,
    `- Follow all mandatory delegation rules in CLAUDE.md (tests → TestScaffold, components → ComponentBuilder, etc.).`,
    `- Commit your changes using Conventional Commit messages (\`corepack yarn ai:commit\`).`,
    `- Do NOT push and do NOT open a PR — this sandbox has no credentials. Just commit locally on your branch; leave nothing uncommitted. The orchestrator integrates your branch into the feature branch on the host.`,
    `- When implementation is complete, output <promise>COMPLETE</promise>.`,
    ``,
    `## Running tests in this sandbox`,
    ``,
    `Do NOT use \`yarn nx run ... test\`, \`corepack yarn nx\`, or any Nx wrapper to run tests.`,
    `Nx adds overhead and can appear hung when the suite takes longer than expected.`,
    `Use this command directly, substituting the actual lib path:`,
    ``,
    `  node node_modules/.bin/jest \\`,
    `    --config=<libpath>/jest.config.ts \\`,
    `    --no-coverage \\`,
    `    --forceExit \\`,
    `    --passWithNoTests \\`,
    `    --testPathIgnorePatterns='\\.integration\\.spec\\.'`,
    ``,
    `Example: \`node node_modules/.bin/jest --config=libs/web/pages/groceries/jest.config.ts --no-coverage --forceExit --passWithNoTests --testPathIgnorePatterns='\\.integration\\.spec\\.'\``,
    ``,
    `Flag reference:`,
    `- \`--no-coverage\`                    removes instrumentation overhead`,
    `- \`--forceExit\`                       prevents open-handle hangs after tests complete`,
    `- \`--passWithNoTests\`                 avoids a non-zero exit when no files match`,
    `- \`--testPathIgnorePatterns\`          skips \`*.integration.spec.*\` files — these need CI resources, not the sandbox`,
    ``,
    `Run synchronously — do not background the process or poll temp files.`,
    `Use a Bash timeout of at least 600 s; a full lib suite takes 5–8 min in Docker.`,
    `To run a subset, append \`--testPathPattern='<dir or filename fragment>'\`.`,
  ].join('\n');
}

// ─── Dispatch slices one by one ───────────────────────────────────────────────

type SliceResult = {
  issue: Issue;
  sliceBranch: string;
  commits: number;
  merged: boolean;
  reason: string;
};

const results: SliceResult[] = [];
const crashed: Array<{ issue: Issue; error: string }> = [];
const agentKind = resolveAgentKind();

for (const issue of slices) {
  const model = resolveModel(issue, agentKind);
  const agent = buildAgent(agentKind, model);
  const sliceBranch = sliceBranchFor(issue);

  ghSilent([
    'issue',
    'edit',
    String(issue.number),
    '--repo',
    REPO,
    '--add-label',
    'status:in-progress',
  ]);

  try {
    console.log(
      `\n  → #${issue.number} on ${sliceBranch} (${agentKind}:${model})`,
    );

    // Fresh slice branch + worktree off the CURRENT local feature head, so this
    // slice (processed one by one) builds on every previously-integrated slice.
    // Clear any stale branch/worktree from an earlier run first.
    const worktreeName = sliceBranch.replace(/\//g, '-');
    const worktreePath = join(worktreesDir, worktreeName);
    if (existsSync(worktreePath)) {
      spawnSync('git', ['worktree', 'remove', '--force', worktreePath], {
        encoding: 'utf8',
        windowsHide: true,
      });
    }
    spawnSync('git', ['worktree', 'prune'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    spawnSync('git', ['branch', '-D', sliceBranch], {
      encoding: 'utf8',
      windowsHide: true,
    });
    gitCmd(['branch', sliceBranch, featureBranch]);
    const wt = spawnSync(
      'git',
      ['worktree', 'add', worktreePath, sliceBranch],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    if (wt.status !== 0) {
      throw new Error(
        `could not create worktree for ${sliceBranch}: ${wt.stderr.trim()}`,
      );
    }

    const result = await run({
      agent,
      sandbox: docker({
        env: {
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_SKIP_NX_CACHE: 'true',
          ...YARN_CACHE_ENV,
        },
        // Bind-mount the shared, content-addressable Yarn global cache so the
        // in-container install (below) is incremental and never re-downloads
        // across slices.
        mounts: [
          { hostPath: yarnCacheDir, sandboxPath: '/home/agent/.yarn-cache' },
        ],
      }),
      name: `#${issue.number}`,
      branchStrategy: {
        type: 'branch',
        branch: sliceBranch,
        baseBranch: featureBranch,
      },
      // Install this slice's deps INSIDE the container before the agent starts, so
      // native binaries match the container's platform (correct on WSL2, Linux, and
      // macOS hosts). Writes node_modules to the bind-mounted worktree, which MUST
      // be on a native fs (ext4/APFS) — ~2 min there vs ~29 min on a Windows mount.
      hooks: {
        sandbox: {
          onSandboxReady: [
            {
              command: 'corepack yarn install --immutable',
              timeoutMs: 1200000,
            },
          ],
        },
      },
      maxIterations: 25,
      // Quiet stretches (codegen, builds) can exceed the 600s default and trip the
      // idle watchdog; give long-running slices headroom.
      idleTimeoutSeconds: 1800,
      prompt: buildPrompt(issue, sliceBranch),
    });

    // Finalize → gate → integrate, all LOCAL. No push, no PR.
    const hasWork = finalizeSliceBranch(issue, sliceBranch);
    const gatePassed = hasWork ? runSliceGate(issue, sliceBranch) : false;
    const mergeOk = gatePassed ? integrateSlice(issue, sliceBranch) : false;

    if (mergeOk) {
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
      // Close the slice on successful local integration. status:done + closed
      // makes re-runs idempotent — both this orchestrator's open+afk filter and
      // dispatch-waves treat a closed slice as complete and skip it. The work is
      // on the local feature branch and reaches `main` via the manual PRD PR.
      ghSilent([
        'issue',
        'close',
        String(issue.number),
        '--repo',
        REPO,
        '--reason',
        'completed',
        '--comment',
        `Agent completed and the build gate passed. ${result.commits.length} commit(s) on \`${sliceBranch}\`.\n` +
          `Integrated into the local \`${featureBranch}\` (fast-forward, not pushed) and closed as completed. ` +
          `It will reach \`main\` via the manual PRD PR.`,
      ]);
    } else {
      ghSilent([
        'issue',
        'edit',
        String(issue.number),
        '--repo',
        REPO,
        '--remove-label',
        'status:in-progress',
      ]);
      const reason = !hasWork
        ? 'it produced no commits'
        : !gatePassed
          ? `the build gate (${process.env.SLICE_GATE_TARGETS || 'lint'}) failed`
          : 'the local fast-forward integration failed';
      ghSilent([
        'issue',
        'comment',
        String(issue.number),
        '--repo',
        REPO,
        '--body',
        `Agent finished but ${reason} — slice was NOT integrated into \`${featureBranch}\`. ` +
          `The local branch \`${sliceBranch}\` is left in place for inspection. ` +
          `Later slices in this PRD will NOT include this one until it is fixed and re-run.`,
      ]);
      results.push({
        issue,
        sliceBranch,
        commits: result.commits.length,
        merged: false,
        reason,
      });
      continue;
    }

    results.push({
      issue,
      sliceBranch,
      commits: result.commits.length,
      merged: true,
      reason: 'integrated',
    });
  } catch (e) {
    ghSilent([
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      REPO,
      '--remove-label',
      'status:in-progress',
    ]);
    console.error(`  ✗ #${issue.number} crashed: ${String(e)}`);
    crashed.push({ issue, error: String(e) });
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const merged = results.filter((r) => r.merged);
const blocked = results.filter((r) => !r.merged);

console.log(`\n${'─'.repeat(55)}`);
console.log(
  `Batch done: ${merged.length} integrated, ${blocked.length} blocked (gate/no-work), ${crashed.length} crashed.\n`,
);

for (const r of merged) {
  console.log(
    `  ✓ #${r.issue.number} integrated — ${r.commits} commit(s) on ${featureBranch}`,
  );
}
for (const r of blocked) {
  console.error(`  ⚠ #${r.issue.number} NOT integrated — ${r.reason}`);
}
for (const r of crashed) {
  console.error(`  ✗ #${r.issue.number} crashed — ${r.error}`);
}

if (blocked.length > 0 || crashed.length > 0) {
  console.log(
    `\nOne or more slices did not integrate. Fix them and re-run — done slices are skipped.`,
  );
}
if (merged.length > 0) {
  console.log(`\nNext step: QA the local \`${featureBranch}\` branch`);
  console.log(
    `  git switch ${featureBranch}   # it now contains the merged slices`,
  );
  console.log(`Then push it and open ONE PR to \`main\` manually so CI runs:`);
  console.log(
    `  git push -u origin ${featureBranch} && gh pr create --base main`,
  );
}

// ─── Desktop notification (best-effort; Windows / WSL2 only) ───────────────────

const safeTitle = featureName.replace(/'/g, "''");
spawnSync(
  'powershell.exe',
  [
    '-Command',
    [
      'Add-Type -AssemblyName System.Windows.Forms;',
      `[System.Windows.Forms.MessageBox]::Show(`,
      `  '${merged.length} integrated, ${blocked.length} blocked, ${crashed.length} crashed.` +
        `\\nPRD #${prdNumber}: ${safeTitle}',`,
      `  'dispatch-agents complete', 'OK', 'Information'`,
      `)`,
    ].join(' '),
  ],
  { windowsHide: true },
);
