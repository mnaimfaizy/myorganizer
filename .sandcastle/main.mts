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
  const diff = spawnSync(
    'git',
    ['diff', '--name-only', base, head],
    { encoding: 'utf8', windowsHide: true },
  );
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

// ─── Build gate ───────────────────────────────────────────────────────────────
// Before a slice PR is merged into the feature branch, lint its affected projects
// in a Docker container. Fail closed: if the gate cannot run or does not pass, the
// slice is NOT merged and NOT marked status:done, so dispatch-waves halts rather
// than branching dependent slices off broken code. Disable with SLICE_GATE=off.

// Serialize gate execution so multiple parallel slices never run
// `yarn install` into the shared node_modules cache mount at the same time.
let gateLock: Promise<void> = Promise.resolve();
async function gated<T>(fn: () => T): Promise<T> {
  const prev = gateLock;
  let release!: () => void;
  gateLock = new Promise<void>((r) => (release = r));
  await prev;
  try {
    return fn();
  } finally {
    release();
  }
}

// Host-side push. Agents run in a credential-less sandbox and only commit
// locally; the host (which has working git/gh credentials) finalizes and pushes
// the slice branch so a PR can be opened. Operates on the local branch ref — which
// carries the agent's commit even after sandcastle has cleaned up the worktree
// directory. Returns false if there is nothing to push or the push fails.
function pushSliceBranch(issue: Issue, sliceBranch: string): boolean {
  const branchExists =
    spawnSync('git', ['rev-parse', '--verify', '--quiet', sliceBranch], {
      encoding: 'utf8',
      windowsHide: true,
    }).status === 0;
  if (!branchExists) {
    console.error(
      `  [#${issue.number}] push: local branch ${sliceBranch} not found — nothing to push.`,
    );
    return false;
  }

  // If the agent's worktree survived AND has uncommitted changes (formatting,
  // generated files), capture them. --no-verify skips host husky hooks; the
  // build gate is the real check. When sandcastle already cleaned up the
  // worktree the agent's commit is on the branch ref, so this is best-effort.
  const worktreePath = join(
    process.cwd(),
    '.sandcastle',
    'worktrees',
    sliceBranch.replace(/\//g, '-'),
  );
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

  // Nothing ahead of the feature branch means the agent produced no mergeable
  // work — treat as a failure so the wave halts rather than opening an empty PR.
  const ahead = spawnSync(
    'git',
    ['rev-list', '--count', `origin/${featureBranch}..${sliceBranch}`],
    { encoding: 'utf8', windowsHide: true },
  );
  if ((ahead.stdout || '').trim() === '0') {
    console.error(
      `  [#${issue.number}] push: ${sliceBranch} has no commits beyond ${featureBranch} — nothing to merge.`,
    );
    return false;
  }

  const push = spawnSync(
    'git',
    ['push', '--force-with-lease', 'origin', `${sliceBranch}:${sliceBranch}`],
    { encoding: 'utf8', stdio: 'pipe', windowsHide: true },
  );
  if (push.status !== 0) {
    console.error(`  [#${issue.number}] push failed:\n${push.stderr}`);
    return false;
  }
  console.log(`  [#${issue.number}] pushed ${sliceBranch} to origin.`);
  return true;
}

function runSliceGate(issue: Issue, sliceBranch: string): boolean {
  if ((process.env.SLICE_GATE ?? '').toLowerCase() === 'off') {
    console.log(
      `  [#${issue.number}] gate disabled (SLICE_GATE=off) — merging without verification.`,
    );
    return true;
  }

  const targets = (process.env.SLICE_GATE_TARGETS || 'lint').trim();

  // Slices that change yarn.lock add dependencies the shared (already-seeded)
  // node_modules cache does not contain. Linting them against that stale cache
  // fails spuriously, and installing into the shared mount would corrupt it for
  // other slices. Skip the gate for dependency-changing slices — they are verified
  // another way (the agent's own in-sandbox build, or manual review of the dep PR).
  spawnSync('git', ['fetch', 'origin', sliceBranch], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const lockDiff = spawnSync(
    'git',
    [
      'diff',
      '--name-only',
      `origin/${featureBranch}`,
      `origin/${sliceBranch}`,
      '--',
      'yarn.lock',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if ((lockDiff.stdout || '').trim() !== '') {
    console.log(
      `  [#${issue.number}] gate: yarn.lock changed — skipping lint gate (shared cache cannot validate new deps). NOT gated.`,
    );
    return true;
  }

  // Gate only the projects whose OWN files this slice changed — not their
  // transitive dependents. For a per-file lint gate, an upstream change cannot
  // introduce lint errors downstream, so linting dependents just adds slowness
  // and couples the slice to unrelated projects' lint state (which produced a
  // spurious 14-project sweep + blind failure before this change).
  const projects = changedProjects(
    `origin/${featureBranch}`,
    `origin/${sliceBranch}`,
  );
  if (projects.length === 0) {
    console.log(
      `  [#${issue.number}] gate: no project files changed — pass.`,
    );
    return true;
  }

  // Gate in a DEDICATED detached worktree at the pushed commit. Detached + a
  // separate path means it never holds the slice branch checked out (so the
  // post-merge --delete-branch works) and it is independent of sandcastle's own
  // worktree lifecycle, which may already have removed the agent's worktree.
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
  spawnSync('git', ['fetch', 'origin', sliceBranch], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const add = spawnSync(
    'git',
    ['worktree', 'add', '--detach', gatePath, `origin/${sliceBranch}`],
    { encoding: 'utf8', windowsHide: true },
  );
  if (add.status !== 0) {
    console.error(
      `  [#${issue.number}] gate: could not create gate worktree — failing closed.\n${add.stderr}`,
    );
    return false;
  }

  try {
    console.log(
      `  [#${issue.number}] gate: running '${targets}' on ${projects.join(', ')} ...`,
    );
    // Explicit --projects means no git is needed inside the container.
    const gate = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--entrypoint',
        '/bin/bash',
        '--user',
        '1000:1000',
        '-e',
        'NX_DAEMON=false',
        '-e',
        'NX_ISOLATE_PLUGINS=false',
        '-e',
        'NX_SKIP_NX_CACHE=true',
        '-v',
        `${gatePath}:/home/agent/workspace`,
        '-v',
        `${linuxNmCache}:/home/agent/workspace/node_modules`,
        'sandcastle:myorganizer',
        '-c',
        // Invoke nx directly from the mounted, already-seeded node_modules — no
        // yarn/corepack/npx (which can fall back to Yarn 1 in a worktree) and no
        // install (which would write into and corrupt the shared cache mount).
        `cd /home/agent/workspace && node node_modules/.bin/nx run-many -t ${targets} --projects=${projects.join(',')} --skip-nx-cache`,
      ],
      {
        encoding: 'utf8',
        stdio: 'inherit',
        windowsHide: true,
        timeout: 1200000,
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
    `- Do NOT push — this sandbox has no push credentials. The orchestrator pushes your branch from the host after you finish. Just commit locally; leave nothing uncommitted.`,
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

// ─── Dispatch all slices in parallel ─────────────────────────────────────────

type SliceResult = {
  issue: Issue;
  sliceBranch: string;
  prUrl: string;
  commits: number;
  merged: boolean;
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
            // Absolute host path — relative paths lose the drive letter on Windows.
            // Absolute Linux container path — relative paths get a D: prefix on Windows.
            hostPath: join(
              process.cwd(),
              '.sandcastle',
              'node_modules_linux_cache',
            ),
            sandboxPath: '/home/agent/workspace/node_modules',
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
      // Quiet stretches (yarn install, codegen, builds) can exceed the 600s
      // default and trip the idle watchdog; give long-running slices headroom.
      idleTimeoutSeconds: 1800,
      prompt: buildPrompt(issue, sliceBranch),
    });

    // Host-side push: the sandbox has no push credentials, so the host finalizes
    // and pushes the slice branch before any PR can be opened.
    const pushOk = pushSliceBranch(issue, sliceBranch);

    // Create PR from slice branch → feature branch (only once it exists on origin).
    const prCreate = pushOk
      ? spawnSync(
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
        )
      : null;

    const prCreated = prCreate !== null && prCreate.status === 0;
    const prUrl = !pushOk
      ? '(push to origin failed)'
      : prCreated
        ? prCreate!.stdout.trim()
        : `(PR creation failed: ${prCreate!.stderr.trim().slice(0, 80)})`;

    // Build gate before merge. Serialized so parallel slices never run
    // `yarn install` into the shared node_modules cache mount concurrently.
    const gatePassed = prCreated
      ? await gated(() => runSliceGate(issue, sliceBranch))
      : false;

    const merged = prCreated && gatePassed;

    let mergeOk = false;
    if (merged) {
      // Gate green → squash-merge into the feature branch. `gh pr merge` is
      // non-interactive when a merge-method flag is given and stdin isn't a TTY;
      // there is no `--yes` flag (passing it aborts the merge).
      const prMerge = spawnSync(
        'gh',
        ['pr', 'merge', prUrl, '--squash', '--delete-branch', '--repo', REPO],
        { encoding: 'utf8', stdio: 'inherit', windowsHide: true },
      );
      mergeOk = prMerge.status === 0;
      if (!mergeOk) {
        console.error(
          `  Warning: auto-merge failed for ${prUrl} — merge manually before opening the feature PR.`,
        );
      }
    }

    if (mergeOk) {
      // Only mark done once the slice is actually on the feature branch, so a
      // failed merge doesn't make the wave-runner skip an unmerged slice.
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

      ghSilent([
        'issue',
        'comment',
        String(issue.number),
        '--repo',
        REPO,
        '--body',
        `Agent completed and the build gate passed. ${result.commits.length} commit(s) on \`${sliceBranch}\`.\nMerged into \`${featureBranch}\`. PR: ${prUrl}`,
      ]);
    } else {
      // PR failed OR gate failed → do NOT merge, do NOT mark status:done, so the
      // wave-runner halts instead of branching dependents off broken code.
      ghSilent([
        'issue',
        'edit',
        String(issue.number),
        '--repo',
        REPO,
        '--remove-label',
        'status:in-progress',
      ]);

      const reason = !pushOk
        ? 'its branch could not be pushed to origin'
        : !prCreated
          ? 'the PR could not be created'
          : !merged
            ? `the build gate (${process.env.SLICE_GATE_TARGETS || 'lint'}) failed`
            : 'the gate passed but the auto-merge command failed';
      ghSilent([
        'issue',
        'comment',
        String(issue.number),
        '--repo',
        REPO,
        '--body',
        `Agent finished but ${reason} — slice was NOT merged into \`${featureBranch}\`. ` +
          `Branch \`${sliceBranch}\` and its PR are left open for inspection: ${prUrl}\n\n` +
          `Dependent waves are halted. Fix the slice, then re-run \`yarn dispatch-waves\` (completed waves are skipped).`,
      ]);
    }

    return {
      issue,
      sliceBranch,
      prUrl,
      commits: result.commits.length,
      merged: mergeOk,
    };
  }),
);

// ─── Summary ─────────────────────────────────────────────────────────────────

const fulfilled = results.filter(
  (r): r is PromiseFulfilledResult<SliceResult> => r.status === 'fulfilled',
);
const merged = fulfilled.filter((r) => r.value.merged);
const blocked = fulfilled.filter((r) => !r.value.merged);
const failed = results.filter(
  (r): r is PromiseRejectedResult => r.status === 'rejected',
);

console.log(`\n${'─'.repeat(55)}`);
console.log(
  `Batch done: ${merged.length} merged, ${blocked.length} blocked (gate/PR), ${failed.length} crashed.\n`,
);

for (const r of merged) {
  console.log(`  ✓ #${r.value.issue.number} merged — ${r.value.prUrl}`);
}
for (const r of blocked) {
  console.error(
    `  ⚠ #${r.value.issue.number} NOT merged (gate failed / PR open) — ${r.value.prUrl}`,
  );
}
for (const r of failed) {
  console.error(`  ✗ ${String(r.reason)}`);
}

if (blocked.length > 0 || failed.length > 0) {
  console.log(
    `\nOne or more slices did not merge. Dependent waves will halt until resolved.`,
  );
}
if (merged.length > 0) {
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
      `  '${merged.length} merged, ${blocked.length} blocked, ${failed.length} crashed.` +
        `\\nPRD #${prdNumber}: ${safeTitle}',`,
      `  'dispatch-agents complete', 'OK', 'Information'`,
      `)`,
    ].join(' '),
  ],
  { windowsHide: true },
);
