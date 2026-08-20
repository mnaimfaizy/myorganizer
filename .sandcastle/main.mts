import { claudeCode, copilot, cursor, run } from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  SLICE_DISPOSITIONS,
  buildResumeBrief,
  decideSliceDisposition,
} from '../tools/scripts/lib/sandcastle-resume.mjs';

const REPO = 'mnaimfaizy/myorganizer';
const SANDBOX_IMAGE = 'sandcastle:myorganizer';

dotenv.config({ path: join(process.cwd(), '.sandcastle', '.env') });

type AgentModelPolicy = {
  orchestrators: {
    sandcastle: {
      claudeByComplexity: {
        low: string;
        medium: string;
        high: string;
      };
      cursorDefault: string;
      copilotDefault: string;
    };
  };
};

const agentModelPolicy = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tools', 'config', 'agent-model-policy.json'),
    'utf8',
  ),
) as AgentModelPolicy;
const sandcastleModels = agentModelPolicy.orchestrators.sandcastle;

// ─── Integration model (local-only) ───────────────────────────────────────────
// GitHub coupling is deliberately minimal: we READ the issue(s) and WRITE status
// labels + a completion comment back. That is all.
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
//
// TWO MODES (see the run plan below):
//   • prd   — the model above: `--prd <n>`, integrating into `feat/<slug>`.
//   • issue — `--issue <n>` with NO `--prd`. One ad-hoc issue, cut from origin/main
//     (or `--base`). There is no integration branch, so the work branch IS the
//     deliverable: gate green ends the run, the issue is left OPEN, and nothing is
//     fast-forwarded. Same sandbox, same in-container install, same gate.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(message: string, code = 1): never {
  console.error(`\nError: ${message}`);
  process.exit(code);
}

function ensureSandboxImage(): void {
  const image = spawnSync('docker', ['image', 'inspect', SANDBOX_IMAGE], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (image.status === 0) return;

  console.log(
    `Sandbox image ${SANDBOX_IMAGE} is missing; building it before dispatch...`,
  );
  const build = spawnSync(
    'corepack',
    [
      'yarn',
      'sandcastle',
      'docker',
      'build-image',
      '--image-name',
      SANDBOX_IMAGE,
    ],
    { encoding: 'utf8', stdio: 'inherit', windowsHide: true },
  );

  if (build.status !== 0) {
    fail(
      `Could not build ${SANDBOX_IMAGE}. Check that Docker is running and the active Docker context can build images.`,
    );
  }

  const verification = spawnSync(
    'docker',
    ['image', 'inspect', SANDBOX_IMAGE],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (verification.status !== 0) {
    fail(
      `Docker image ${SANDBOX_IMAGE} was reported built but is not available.`,
    );
  }
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

// ─── Parse arguments ─────────────────────────────────────────────────────────

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
  PRD mode        yarn dispatch-agents --prd <issue-number> [--issue <slice-number>]
  Standalone mode yarn dispatch-agents --issue <issue-number> [--base <ref>]
  Sweep mode      yarn dispatch-agents --all-standalone [--limit <n>] [--base <ref>]

  All accept [--agent claude|cursor|copilot] [--model <model>] [--dry-run]

Flags:
  --prd <issue-number>   PRD issue number to dispatch. Slices integrate into the
                         local feat/<slug> branch, one by one.
  --issue <number>       With --prd: dispatch only this slice of that PRD.
                         Without --prd: standalone mode — dispatch this one issue
                         off --base, leave the result on its own local branch.
  --all-standalone       Sweep mode: dispatch every open issue labelled
                         ready-for-agent + type:afk that is not a PRD slice, each
                         on its own branch. Skips type:hitl, status:blocked, and
                         status:in-progress. Prompts for confirmation first.
  --limit <n>            Sweep mode only: cap how many issues are dispatched.
  --base <ref>           Standalone and sweep modes: base ref for work branches
                         (default: origin/main).
  --dry-run              Resolve and print the plan — issues, branches, models,
                         base, integration target — then exit. Touches no worktree,
                         container, or GitHub state, and builds no sandbox image.
  --yes, -y              Skip the sweep confirmation prompt.
  --agent <name>         Agent provider to use (default: SANDCASTLE_AGENT or claude)
  --model <model>        Override the model for this run (default: env/provider routing)
  --help                 Show this help text

Work branches are named <type>/<issue-number>-<slug>, with <type> derived from the
issue's labels (see AGENTS.md "Branch naming"). PRD slices use slice/<n>-<slug>.

Environment:
  .sandcastle/.env is loaded automatically.
  SANDCASTLE_AGENT
  SANDCASTLE_MODEL
  SANDCASTLE_CLAUDE_MODEL
  SANDCASTLE_CURSOR_MODEL
  SANDCASTLE_COPILOT_MODEL

Claude auth (see docs/sandcastle/RUNBOOK.md):
  CLAUDE_CODE_OAUTH_TOKEN  Pro/Max subscription token from \`claude setup-token\`.
                           Takes precedence; ANTHROPIC_API_KEY is then NOT forwarded.
  ANTHROPIC_API_KEY        Metered API billing. Used only when no OAuth token is set.
  SANDCASTLE_CLAUDE_AUTH   Force one mode: \`subscription\` or \`api\`. Fails if the
                           matching credential is missing.
`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

const USAGE =
  'Usage: yarn dispatch-agents --prd <issue-number> [--issue <slice-number>]\n' +
  '   or: yarn dispatch-agents --issue <issue-number> [--base <ref>]   (standalone, no PRD)\n' +
  '   or: yarn dispatch-agents --all-standalone [--limit <n>] [--base <ref>]   (sweep)';

const prdValue = getArgValue('prd');
const issueValue = getArgValue('issue');
const sweepFlag = process.argv.includes('--all-standalone');

if (!prdValue && !issueValue && !sweepFlag) fail(USAGE);

if (sweepFlag && (prdValue || issueValue)) {
  fail(
    '--all-standalone selects the issue set itself and cannot be combined with --prd or --issue.',
  );
}

const prdNumber = prdValue ? parseInt(prdValue, 10) : undefined;
if (prdValue && isNaN(prdNumber as number)) fail('--prd must be a number.');

const issueNumber = issueValue ? parseInt(issueValue, 10) : undefined;
if (issueValue && isNaN(issueNumber as number)) {
  fail('--issue must be a number.');
}

// Three modes:
//   prd    — slices of one PRD, integrated into a local feat/<slug> branch.
//   issue  — one explicitly named issue. The work branch IS the deliverable:
//            nothing is fast-forwarded and nothing is closed, because the work
//            only reaches `main` once you push the branch and open a PR yourself.
//   sweep  — every agent-ready ad-hoc issue, each handled exactly like `issue`.
//            Nothing was named by a human here, so the label gate is enforced
//            strictly and the selection is confirmed before anything runs.
const mode: 'prd' | 'issue' | 'sweep' = sweepFlag
  ? 'sweep'
  : prdNumber === undefined
    ? 'issue'
    : 'prd';

const baseFlag = getArgValue('base');
if (baseFlag && mode === 'prd') {
  fail(
    '--base applies to standalone and sweep modes only. In PRD mode every slice is cut from the local feature branch.',
  );
}

const dryRun = process.argv.includes('--dry-run');
const assumeYes = process.argv.includes('--yes') || process.argv.includes('-y');

const limitValue = getArgValue('limit');
if (limitValue && mode !== 'sweep') {
  fail('--limit applies to --all-standalone only.');
}
const limit = limitValue ? parseInt(limitValue, 10) : undefined;
if (limitValue && (isNaN(limit as number) || (limit as number) < 1)) {
  fail('--limit must be a positive number.');
}

const agentFlag = getArgValue('agent');
const modelFlag = getArgValue('model');

// ─── Claude auth mode ─────────────────────────────────────────────────────────
// Two ways to authenticate the Claude Code agent inside the sandbox:
//
//   • subscription — CLAUDE_CODE_OAUTH_TOKEN, produced by `claude setup-token` on
//     the host (requires an active Pro/Max plan). Bills against that plan, which is
//     the SAME quota as your interactive Claude Code sessions: a long AFK batch of
//     complexity:high (opus) slices can throttle you at the keyboard.
//   • api — ANTHROPIC_API_KEY. Metered per token, isolated from the plan quota.
//
// We forward exactly ONE of them into the container. Which credential Claude Code
// prefers when both are present is version-dependent, so a stale ANTHROPIC_API_KEY
// sitting next to a valid token can silently bill the API while you believe you are
// on the plan. Resolve the mode up front, fail loudly if the credential is missing
// (before we build worktrees and containers), and print the mode in the run header.

type ClaudeAuthMode = 'subscription' | 'api';

function resolveClaudeAuth(kind: AgentKind): ClaudeAuthMode | null {
  if (kind !== 'claude') return null;

  const hasToken = Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN);
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const forced = (process.env.SANDCASTLE_CLAUDE_AUTH ?? '')
    .trim()
    .toLowerCase();

  if (forced && forced !== 'subscription' && forced !== 'api') {
    fail(
      `SANDCASTLE_CLAUDE_AUTH must be "subscription" or "api" (got "${forced}").`,
    );
  }

  if (forced === 'subscription' && !hasToken) {
    fail(
      'SANDCASTLE_CLAUDE_AUTH=subscription but CLAUDE_CODE_OAUTH_TOKEN is not set.\n' +
        'Run `claude setup-token` on the host and store the result in your 1Password Environment.',
    );
  }
  if (forced === 'api' && !hasApiKey) {
    fail('SANDCASTLE_CLAUDE_AUTH=api but ANTHROPIC_API_KEY is not set.');
  }

  if (forced === 'subscription' || forced === 'api') return forced;

  // Unforced: the subscription token wins when both are available.
  if (hasToken) return 'subscription';
  if (hasApiKey) return 'api';

  fail(
    'No Claude credential found. Set one of:\n' +
      '  CLAUDE_CODE_OAUTH_TOKEN  — `claude setup-token` on the host (Pro/Max plan)\n' +
      '  ANTHROPIC_API_KEY        — metered API billing\n' +
      'See docs/sandcastle/RUNBOOK.md. Both are normally injected via 1Password.',
  );
}

const agentKind = resolveAgentKind();
const claudeAuth = resolveClaudeAuth(agentKind);

// Only now — after --help, argument validation, and the credential preflight have
// all had their say. Building this image can take minutes; there is no reason to
// pay for it before we know the run can actually authenticate. A --dry-run never
// launches a container, so it must not pay for the image either.
if (!dryRun) ensureSandboxImage();

// ─── Fetch PRD issue ──────────────────────────────────────────────────────────

type Issue = {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  labels: Array<{ name: string }>;
  body: string;
};

function isCompleted(issue: Issue): boolean {
  return (
    issue.state === 'CLOSED' ||
    issue.labels.some((label) => label.name === 'status:done')
  );
}

function blockedBy(issue: Issue): number[] {
  const section = issue.body.match(
    /##\s+Blocked by\s*([\s\S]*?)(?=\n##\s|$)/i,
  )?.[1];
  if (!section || /^\s*-\s*None\s*$/im.test(section)) return [];

  return [...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
}

function blocks(issue: Issue): number[] {
  const section = issue.body.match(
    /##\s+Blocks\s*([\s\S]*?)(?=\n##\s|$)/i,
  )?.[1];
  if (!section || /^\s*-\s*None\b/im.test(section)) return [];

  return [...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
}

function isIssueSatisfied(issue: Issue | undefined): boolean {
  if (!issue) return false;
  return isCompleted(issue);
}

/**
 * After a slice completes, clear `status:blocked` on dependents whose
 * ## Blocked by deps are all done/closed. Prefer ## Blocks on the completed
 * issue; also scan same-PRD open slices as a fallback.
 */
function unblockDependents(completed: Issue): void {
  const prdMatch = completed.body?.match(/PRD:\s*#(\d+)/i);
  const prdRef = prdMatch ? `PRD: #${prdMatch[1]}` : null;

  const candidateNumbers = new Set<number>(blocks(completed));
  for (const issue of allIssues) {
    if (issue.number === completed.number) continue;
    if (prdRef && !issue.body?.includes(prdRef)) continue;
    if (blockedBy(issue).includes(completed.number)) {
      candidateNumbers.add(issue.number);
    }
  }

  if (candidateNumbers.size === 0) return;

  // Refresh issue metadata for accurate labels/state.
  const byNumber = new Map<number, Issue>();
  for (const issue of allIssues) {
    byNumber.set(issue.number, issue);
  }
  byNumber.set(completed.number, {
    ...completed,
    state: 'CLOSED',
    labels: [
      ...completed.labels.filter((l) => l.name !== 'status:in-progress'),
      { name: 'status:done' },
    ],
  });

  for (const dependentNumber of candidateNumbers) {
    let dependent = byNumber.get(dependentNumber);
    if (!dependent) {
      try {
        dependent = ghJson<Issue>([
          'issue',
          'view',
          String(dependentNumber),
          '--repo',
          REPO,
          '--json',
          'number,title,state,labels,body',
        ]);
        byNumber.set(dependentNumber, dependent);
      } catch {
        console.warn(
          `  [#${completed.number}] unblock: could not load dependent #${dependentNumber}`,
        );
        continue;
      }
    }

    if (!dependent.labels.some((l) => l.name === 'status:blocked')) {
      continue;
    }

    const deps = blockedBy(dependent);
    const unfinished = deps.filter((blockerNumber) => {
      if (blockerNumber === completed.number) return false;
      const blocker = byNumber.get(blockerNumber);
      return !isIssueSatisfied(blocker);
    });

    if (unfinished.length > 0) {
      console.log(
        `  [#${completed.number}] #${dependentNumber} still blocked by ${unfinished
          .map((n) => `#${n}`)
          .join(', ')}`,
      );
      continue;
    }

    ghSilent([
      'issue',
      'edit',
      String(dependentNumber),
      '--repo',
      REPO,
      '--remove-label',
      'status:blocked',
    ]);
    ghSilent([
      'issue',
      'comment',
      String(dependentNumber),
      '--repo',
      REPO,
      '--body',
      `Unblocked: #${completed.number} is done. Remaining blockers: none — ready for agent.`,
    ]);
    console.log(
      `  [#${completed.number}] removed status:blocked from #${dependentNumber}`,
    );
  }
}

// ─── Build the run plan ───────────────────────────────────────────────────────
// The modes differ in exactly three things — where work branches are cut from,
// whether finished work is fast-forwarded anywhere, and how the issue set is chosen.
// Everything downstream (sandbox, in-container install, gate, prompt, usage log)
// is shared and reads from this plan.
//
//   prd   — integrationBranch = local `feat/<slug>`, also the base each slice is cut
//           from, so slice N sees slices 1..N-1. Issues are the PRD's ready AFK
//           slices, ordered by `## Blocked by`.
//   issue — integrationBranch = null. One explicitly named issue, cut from
//           origin/main (or --base). Its branch IS the deliverable: nothing is
//           fast-forwarded, nothing is closed. You QA it, push it, open the PR.
//   sweep — identical to `issue` in every downstream respect, run once per selected
//           issue. Only the selection differs, and it is the one place where nobody
//           named an issue by hand — so the label gate is enforced rather than
//           warned about, and the whole set is confirmed before the first container.

gitCmd(['fetch', 'origin', 'main']);

type RunPlan = {
  /** Ref every work branch is cut from, and the gate's diff base. */
  baseRef: string;
  /** Local branch finished work fast-forwards into; null in standalone mode. */
  integrationBranch: string | null;
  issues: Issue[];
  /** Full repo issue list, for dependency unblocking. Empty in standalone mode. */
  allIssues: Issue[];
};

function planPrdRun(prd: number): RunPlan {
  const prdIssue = ghJson<Pick<Issue, 'title' | 'body'>>([
    'issue',
    'view',
    String(prd),
    '--repo',
    REPO,
    '--json',
    'title,body',
  ]);

  const name = prdIssue.title.replace(/^\[PRD\]\s*/i, '').trim();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const branch = `feat/${slug}`;

  console.log(`\nPRD #${prd}: ${name}`);
  console.log(`Feature branch:  ${branch} (local only — never pushed)`);

  // The PRD branch is created once, locally, from the freshest main. It is the
  // integration target for every slice in this PRD. We do NOT create it on origin
  // and we do NOT push it — you push it by hand after QA to open the PRD PR.
  // A --dry-run must not leave it behind either: creating the branch is a real
  // mutation, and a preview that alters the repo is not a preview.
  if (gitRefExists(branch)) {
    console.log(`Reusing existing local branch ${branch}.`);
  } else if (dryRun) {
    console.log(`Would create local branch ${branch} from origin/main.`);
  } else {
    const base = gitRefExists('origin/main') ? 'origin/main' : 'main';
    gitCmd(['branch', branch, base]);
    console.log(`Created local branch ${branch} from ${base} (not pushed).`);
  }

  const everyIssue = ghJson<Issue[]>([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'all',
    '--json',
    'number,title,state,labels,body',
    '--limit',
    '100',
  ]);

  const isAfkSlice = (issue: Issue): boolean =>
    issue.labels.some((label) => label.name === 'ready-for-agent') &&
    issue.labels.some((label) => label.name === 'type:afk');

  const selected = everyIssue.filter(
    (i) =>
      i.body?.includes(`PRD: #${prd}`) &&
      isAfkSlice(i) &&
      (issueNumber === undefined || i.number === issueNumber) &&
      !i.labels.some((label) => label.name === 'status:blocked') &&
      i.state === 'OPEN' &&
      // Skip slices already merged into the feature branch so re-runs are
      // idempotent — only undone work in the wave is re-dispatched.
      !isCompleted(i),
  );

  if (selected.length === 0) {
    fail(
      issueNumber === undefined
        ? `No open AFK slice issues found for PRD #${prd}.\n` +
            `Run /to-issues ${prd} to create them first.`
        : `Slice issue #${issueNumber} was not found as an open AFK slice for PRD #${prd}.\n` +
            `Check its labels and PRD reference, or run it standalone:\n` +
            `  yarn dispatch-agents --issue ${issueNumber}`,
    );
  }

  return {
    baseRef: branch,
    integrationBranch: branch,
    issues: selected,
    allIssues: everyIssue,
  };
}

function planStandaloneRun(number: number): RunPlan {
  const issue = ghJson<Issue>([
    'issue',
    'view',
    String(number),
    '--repo',
    REPO,
    '--json',
    'number,title,state,labels,body',
  ]);

  if (issue.state === 'CLOSED') {
    fail(`Issue #${number} is closed. Reopen it before dispatching.`);
  }

  const base =
    baseFlag ?? (gitRefExists('origin/main') ? 'origin/main' : 'main');
  if (!gitRefExists(base)) fail(`Base ref "${base}" does not resolve locally.`);

  console.log(`\nIssue #${number}: ${issue.title}`);
  console.log(`Base:            ${base}`);
  console.log(`Standalone — no PRD, no integration branch. Nothing is pushed.`);

  // Naming the issue explicitly IS the authorization: standalone runs do not
  // require ready-for-agent / type:afk. Labels that normally mean "a human wanted
  // this one" are surfaced as warnings so a mis-typed number is still visible.
  const labels = issue.labels.map((label) => label.name);
  for (const flagged of ['type:hitl', 'status:blocked', 'status:in-progress']) {
    if (labels.includes(flagged)) {
      console.warn(`  ⚠ #${number} carries "${flagged}" — dispatching anyway.`);
    }
  }

  return {
    baseRef: base,
    integrationBranch: null,
    issues: [issue],
    allIssues: [],
  };
}

/**
 * Every open issue the orchestrator may pick up on its own authority: explicitly
 * marked agent-ready, not part of a PRD (those belong to `--prd`, which orders them
 * by dependency and integrates them), and not carrying a label that means a human
 * still has to look at it.
 *
 * The `type:hitl` / `status:blocked` warnings that standalone mode prints are hard
 * exclusions here. Standalone treats naming an issue as the authorization; a sweep
 * has no such signal, so the labels are the only gate there is.
 */
function planSweepRun(): RunPlan {
  const base =
    baseFlag ?? (gitRefExists('origin/main') ? 'origin/main' : 'main');
  if (!gitRefExists(base)) fail(`Base ref "${base}" does not resolve locally.`);

  const everyIssue = ghJson<Issue[]>([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'open',
    '--json',
    'number,title,state,labels,body',
    '--limit',
    '200',
  ]);

  const eligible = everyIssue.filter((issue) => {
    const labels = issue.labels.map((label) => label.name);
    return (
      labels.includes('ready-for-agent') &&
      labels.includes('type:afk') &&
      !labels.includes('type:hitl') &&
      !labels.includes('status:blocked') &&
      !labels.includes('status:in-progress') &&
      // A PRD parent is a spec, not implementable work, and its body carries
      // `## Slices` rather than a `PRD: #` back-reference — so the slice filter
      // below would not catch it.
      !labels.includes('prd') &&
      // PRD slices are `--prd`'s business: it orders them by `## Blocked by` and
      // integrates them into a feature branch. Sweeping them one-off would strand
      // each on its own branch with no integration target.
      !/^\s*PRD:\s*#\d+/m.test(issue.body ?? '')
    );
  });

  const selected = [...eligible]
    .sort((left, right) => left.number - right.number)
    .slice(0, limit ?? eligible.length);

  if (selected.length === 0) {
    fail(
      'No eligible issues for a sweep.\n' +
        'An issue qualifies when it is open, labelled `ready-for-agent` + `type:afk`,\n' +
        'carries no `type:hitl` / `status:blocked` / `status:in-progress`, and has no\n' +
        '`PRD: #<n>` reference (PRD slices belong to `--prd`).',
    );
  }

  console.log(`\nSweep — every agent-ready ad-hoc issue.`);
  console.log(`Base:            ${base}`);
  console.log(
    `Selected:        ${selected.length} of ${eligible.length} eligible` +
      (limit !== undefined && eligible.length > selected.length
        ? ` (--limit ${limit})`
        : ''),
  );
  console.log(`No integration branch. Nothing is pushed, nothing is closed.`);

  return {
    baseRef: base,
    integrationBranch: null,
    issues: selected,
    allIssues: [],
  };
}

const plan =
  mode === 'prd'
    ? planPrdRun(prdNumber as number)
    : mode === 'sweep'
      ? planSweepRun()
      : planStandaloneRun(issueNumber as number);

const { baseRef, integrationBranch, allIssues } = plan;
const slices = plan.issues;

console.log(
  `Agent:           ${agentKind}${
    claudeAuth
      ? claudeAuth === 'subscription'
        ? ' (auth: subscription — shares your Pro/Max quota)'
        : ' (auth: API key — metered)'
      : ''
  }\n`,
);

const completedIssueNumbers = new Set(
  allIssues
    .filter(
      (issue) =>
        issue.body?.includes(`PRD: #${prdNumber}`) && isCompleted(issue),
    )
    .map((issue) => issue.number),
);

function nextReadySlice(pending: Issue[]): Issue | undefined {
  // `## Blocked by` ordering is PRD vocabulary. Standalone runs a single issue the
  // human named explicitly — honouring a stale blocker section there would silently
  // refuse to run it, since completedIssueNumbers is empty by construction.
  const ready =
    mode === 'prd'
      ? pending.filter((issue) =>
          blockedBy(issue).every((dependency) =>
            completedIssueNumbers.has(dependency),
          ),
        )
      : pending;

  return ready.sort((left, right) => left.number - right.number)[0];
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

// The "dispatching" banner is deliberately NOT printed here: a --dry-run dispatches
// nothing, and a sweep may still be declined at the confirmation prompt. It is
// printed once the run is actually committed to, just below the preview block.

// ─── Model routing ────────────────────────────────────────────────────────────

type AgentKind = 'claude' | 'cursor' | 'copilot';

function modelFor(issue: Issue): string {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes('complexity:high'))
    return sandcastleModels.claudeByComplexity.high;
  if (labels.includes('complexity:medium'))
    return sandcastleModels.claudeByComplexity.medium;
  return sandcastleModels.claudeByComplexity.low;
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
      return (
        process.env.SANDCASTLE_CURSOR_MODEL ?? sandcastleModels.cursorDefault
      );
    case 'copilot':
      return (
        process.env.SANDCASTLE_COPILOT_MODEL ?? sandcastleModels.copilotDefault
      );
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

function providerEnvironment(): Record<string, string> {
  // Exactly one Claude credential reaches the container — see resolveClaudeAuth.
  // On cursor/copilot runs claudeAuth is null and neither is forwarded.
  const claudeVariables =
    claudeAuth === 'subscription'
      ? ['CLAUDE_CODE_OAUTH_TOKEN']
      : claudeAuth === 'api'
        ? ['ANTHROPIC_API_KEY']
        : [];

  const variableNames = [
    ...claudeVariables,
    'CURSOR_API_KEY',
    'COPILOT_GITHUB_TOKEN',
    'GH_TOKEN',
    'GITHUB_TOKEN',
  ];

  return Object.fromEntries(
    variableNames.flatMap((variableName) => {
      const value = process.env[variableName];
      return value ? [[variableName, value]] : [];
    }),
  );
}

// Branch type is read off the issue's labels so the branch name says what the work
// does, not merely which issue it came from — see AGENTS.md "Branch naming". First
// match wins, so the more specific intent (a security bug is a fix, not a chore)
// must come first.
// Order is significant: issues carry several of these at once. `qa` and `research`
// rank last because they describe why work is tracked, not what it changes — #290
// is labelled tooling + maintenance + qa but is a code fix, so `tooling` must win.
const BRANCH_TYPE_BY_LABEL: ReadonlyArray<readonly [string, string]> = [
  ['bug', 'fix'],
  ['security', 'fix'],
  ['enhancement', 'feat'],
  ['documentation', 'docs'],
  ['tooling', 'chore'],
  ['maintenance', 'chore'],
  ['dependencies', 'chore'],
  ['research', 'docs'],
  ['qa', 'chore'],
];

/** Conventional-commit type for an issue's work branch. Defaults to `chore`. */
function branchTypeFor(issue: Issue): string {
  const labels = new Set(issue.labels.map((label) => label.name));
  for (const [label, type] of BRANCH_TYPE_BY_LABEL) {
    if (labels.has(label)) return type;
  }
  return 'chore';
}

/** Every branch prefix a non-PRD work branch can be created under. */
const WORK_BRANCH_TYPES = [
  ...new Set(BRANCH_TYPE_BY_LABEL.map(([, type]) => type)),
  // Legacy: standalone runs used a flat `issue/` prefix before AGENTS.md pinned
  // the convention. Kept so stale branches from those runs are still cleaned up.
  'issue',
];

function slugFor(issue: Issue): string {
  return issue.title
    .replace(/^\[Slice\]\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function sliceBranchFor(issue: Issue): string {
  // PRD slices keep `slice/`, and the prefix is load-bearing: it marks a branch that
  // fast-forwards into a feature branch and closes its issue on success. Keeping it
  // distinct from the work-branch types also preserves the guarantee that a
  // standalone re-run of an issue that later becomes a PRD slice (or vice versa)
  // can never collide on a branch, worktree, or gate path.
  return mode === 'prd'
    ? `slice/${issue.number}-${slugFor(issue)}`
    : `${branchTypeFor(issue)}/${issue.number}-${slugFor(issue)}`;
}

/**
 * Branches a previous run of this issue may have left behind.
 *
 * The type is derived from labels, so re-running an issue whose labels changed
 * produces a different branch name than last time — deleting only the currently
 * computed name would orphan the old branch and its worktree.
 */
function staleWorkBranchesFor(issue: Issue): string[] {
  if (mode === 'prd') return [];
  const current = sliceBranchFor(issue);
  const slug = slugFor(issue);
  return WORK_BRANCH_TYPES.map((type) => `${type}/${issue.number}-${slug}`)
    .filter((branch) => branch !== current)
    .filter((branch) => gitRefExists(branch));
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

  // Nothing ahead of the base means the agent produced no work.
  const ahead = spawnSync(
    'git',
    ['rev-list', '--count', `${baseRef}..${sliceBranch}`],
    { encoding: 'utf8', windowsHide: true },
  );
  if ((ahead.stdout || '').trim() === '0') {
    console.error(
      `  [#${issue.number}] ${sliceBranch} has no commits beyond ${baseRef} — nothing to integrate.`,
    );
    return false;
  }
  return true;
}

// ─── Interrupted slices ─────────────────────────────────────────────
// An agent run that ends without a completion signal — a provider limit, a timeout,
// a container fault — leaves its work uncommitted in the preserved worktree, and the
// slice branch itself is force-deleted the next time this issue is dispatched. Commit
// that work as a Slice Checkpoint and TAG it: the tag keeps the commit reachable after
// `git branch -D`, so the existing gate-failure retry flow (delete the branch, run the
// slice again from a clean base) keeps working untouched. See ADR 0035; resuming from
// a checkpoint rather than merely surviving is PRD #401.

/**
 * Read the git facts the resume decision needs. Impure by nature — kept here rather
 * than in the decision library so the decision itself stays testable without git.
 */
function inspectSliceBranch(sliceBranch: string): {
  branchExists: boolean;
  commitsAhead: number;
  mergeBaseMatchesBase: boolean;
} {
  if (!gitRefExists(sliceBranch)) {
    return {
      branchExists: false,
      commitsAhead: 0,
      mergeBaseMatchesBase: false,
    };
  }

  const commitsAhead = Number.parseInt(
    (
      spawnSync('git', ['rev-list', '--count', `${baseRef}..${sliceBranch}`], {
        encoding: 'utf8',
        windowsHide: true,
      }).stdout || ''
    ).trim(),
    10,
  );

  const mergeBase = (
    spawnSync('git', ['merge-base', sliceBranch, baseRef], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  ).trim();
  const baseSha = (
    spawnSync('git', ['rev-parse', baseRef], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  ).trim();

  return {
    branchExists: true,
    commitsAhead,
    mergeBaseMatchesBase: mergeBase !== '' && mergeBase === baseSha,
  };
}

/** The checkpoint sitting on a slice branch, for the resume brief's inventory. */
function readSliceCheckpoint(
  sliceBranch: string,
): { sha: string; files: string[] } | undefined {
  const sha = (
    spawnSync('git', ['rev-parse', '--short', sliceBranch], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  ).trim();
  if (!sha) return undefined;

  const files = (
    spawnSync('git', ['diff', '--name-only', `${baseRef}..${sliceBranch}`], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  )
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  return { sha, files };
}

type SliceCheckpoint = {
  readonly sha: string;
  readonly tag: string;
  readonly fileCount: number;
};

/** Newest sandcastle log for this issue, or undefined when none was written. */
function sliceLogPathFor(issueNumber: number): string | undefined {
  const logsDir = join(process.cwd(), '.sandcastle', 'logs');
  if (!existsSync(logsDir)) return undefined;
  const suffix = `--${issueNumber}.log`;
  const candidates = readdirSync(logsDir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => join(logsDir, name))
    .filter((path) => existsSync(path));
  if (candidates.length === 0) return undefined;
  return candidates.sort(
    (left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs,
  )[0];
}

/**
 * The thrown AgentError carries whatever was last on stderr, which is routinely a
 * trailing warning rather than the cause. Surface the log tail next to it instead of
 * classifying it — provider-specific limit matchers belong to PRD #401, and this
 * orchestrator runs claude, cursor, and copilot.
 */
function crashLogTail(issueNumber: number, lines = 15): string | undefined {
  const logPath = sliceLogPathFor(issueNumber);
  if (!logPath) return undefined;
  let contents: string;
  try {
    contents = readFileSync(logPath, 'utf8');
  } catch {
    return undefined;
  }
  const tail = contents
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(-lines);
  if (tail.length === 0) return undefined;
  return `  log tail (${logPath}):\n${tail
    .map((line) => `    ${line}`)
    .join('\n')}`;
}

/**
 * Commit whatever the interrupted agent left behind onto its slice branch and tag it.
 * Returns the checkpoint, or undefined when there was nothing to preserve.
 *
 * --no-verify is deliberate: husky would lint and format half-finished code and
 * corrupt the very evidence being preserved. This mirrors the capture
 * finalizeSliceBranch performs on the success path.
 */
function preserveInterruptedSlice(
  issue: Issue,
  sliceBranch: string,
): SliceCheckpoint | undefined {
  if (!gitRefExists(sliceBranch)) return undefined;

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
      const commit = spawnSync(
        'git',
        [
          '-C',
          worktreePath,
          'commit',
          '--no-verify',
          '-m',
          `wip(slice): checkpoint interrupted #${issue.number} agent run\n\n` +
            `The agent run ended without a completion signal and this work was left\n` +
            `uncommitted in the preserved worktree. NOT reviewed, NOT gated, NOT ready\n` +
            `to ship — files present here do not mean a Gated Pipeline ran.\n\n` +
            `Refs #${issue.number}`,
        ],
        { encoding: 'utf8', windowsHide: true },
      );
      if (commit.status !== 0) {
        console.error(
          `  [#${issue.number}] could not commit the interrupted worktree:\n${commit.stderr}`,
        );
      }
    }
  }

  // Nothing ahead of the base means there is no work to protect.
  const ahead = (
    spawnSync('git', ['rev-list', '--count', `${baseRef}..${sliceBranch}`], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  ).trim();
  if (ahead === '' || ahead === '0') return undefined;

  const sha = (
    spawnSync('git', ['rev-parse', '--short', sliceBranch], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  ).trim();

  // -f so a later interruption of the same slice re-points the tag at the newer
  // checkpoint rather than failing and leaving the run without protection.
  const tag = `wip/${issue.number}-checkpoint`;
  spawnSync('git', ['tag', '-f', tag, sliceBranch], {
    encoding: 'utf8',
    windowsHide: true,
  });

  const fileCount = (
    spawnSync('git', ['diff', '--name-only', `${baseRef}..${sliceBranch}`], {
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  )
    .split('\n')
    .filter((line) => line.trim() !== '').length;

  return { sha, tag, fileCount };
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
  const projects = changedProjects(baseRef, sliceBranch);
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
        SANDBOX_IMAGE,
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
//
// Standalone runs never reach this: with no PRD there is no integration target, so
// the work branch is left exactly as the agent committed it.
function integrateSlice(
  issue: Issue,
  sliceBranch: string,
  featureBranch: string,
): boolean {
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

  const findCheckedOutWorktreeForBranch = (branch: string): string | null => {
    const wt = spawnSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (wt.status !== 0 || !wt.stdout.trim()) return null;

    let worktreePath: string | null = null;
    for (const line of wt.stdout.split('\n')) {
      if (!line.trim()) {
        worktreePath = null;
        continue;
      }
      if (line.startsWith('worktree ')) {
        worktreePath = line.slice('worktree '.length).trim();
        continue;
      }
      if (
        line === `branch refs/heads/${branch}` &&
        typeof worktreePath === 'string'
      ) {
        return worktreePath;
      }
    }
    return null;
  };

  const mergeInCheckedOutWorktree = (): boolean => {
    const worktreePath = findCheckedOutWorktreeForBranch(featureBranch);
    if (!worktreePath) return false;

    const ffMerge = spawnSync(
      'git',
      ['-C', worktreePath, 'merge', '--ff-only', sliceBranch],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    if (ffMerge.status !== 0) {
      console.error(
        `  [#${issue.number}] integrate: failed to fast-forward ${featureBranch} in checked-out worktree ${worktreePath}.\n${ffMerge.stderr}`,
      );
      return false;
    }

    console.log(
      `  [#${issue.number}] integrated into local ${featureBranch} (fast-forward in checked-out worktree).`,
    );
    return true;
  };

  const ff = spawnSync('git', ['branch', '-f', featureBranch, sliceBranch], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (ff.status !== 0) {
    if (ff.stderr.includes('cannot force update the branch')) {
      return mergeInCheckedOutWorktree();
    }
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

function resolveGate(issue: Issue): 'mechanical' | 'standard' | 'full' {
  const labels = issue.labels.map((l) => l.name);
  if (labels.includes('gate:mechanical')) return 'mechanical';
  if (labels.includes('gate:full')) return 'full';
  return 'standard';
}

function buildGateInstructions(
  gate: 'mechanical' | 'standard' | 'full',
): string[] {
  const common = [
    `- Quality gate for this slice: \`gate:${gate}\` (ADR 0012 / \`.claude/checklist.md\`).`,
    `- Prefer short specialist reports (\`PASS|FAIL|ESCALATE\` + ≤5 bullets).`,
    `- Gated Pipeline reject-cycles: max 2 (ComponentReviewer and TestReviewer), then escalate with a diagnosis (ADR 0017).`,
    `- Hitting the cap, a repeated FAIL, or a static/reviewer PASS then Runner/tsc/eslint FAIL is a Pipeline Incident — comment \`## Pipeline Incident\` on the Slice Issue.`,
    `- \`/code-review\` runs once per Slice after deterministic checks are green, not after every specialist hop.`,
  ];

  if (gate === 'mechanical') {
    return [
      ...common,
      `- Mechanical path: main agent may edit directly (fixture/type retarget, rename, dead delete, selector-only E2E, verify-already-done).`,
      `- Do NOT run TestScaffold → TestReviewer → TestRunner or ComponentBuilder → ComponentReviewer for mechanical work.`,
      `- Still run focused deterministic checks (jest/tsc/eslint on touched files).`,
    ];
  }

  if (gate === 'full') {
    return [
      ...common,
      `- Full path: follow mandatory specialist pipelines in CLAUDE.md for behavioral tests, stories, and components.`,
      `- E2E: E2EPlanner → TestScaffold → TestReviewer (structural only); never execute Playwright in this sandbox.`,
    ];
  }

  return [
    ...common,
    `- Standard path: one specialist hop for the changed artifact type (not every pipeline by default).`,
    `- Follow CLAUDE.md / \`.claude/checklist.md\` for which agent chain applies.`,
    `- Skip E2EPlanner only for selector-only E2E edits when the flow matrix is unchanged.`,
  ];
}

function buildPrompt(issue: Issue, sliceBranch: string): string {
  const gate = resolveGate(issue);
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
    `- Your working branch is \`${sliceBranch}\` (based on \`${baseRef}\`). Do not switch branches.`,
    ...buildGateInstructions(gate),
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

function logRunUsage(
  issueNumber: number,
  agentKind: AgentKind,
  model: string,
  result: Awaited<ReturnType<typeof run>>,
): void {
  const usageDir = join(process.cwd(), '.sandcastle', 'usage');
  const usageFile = join(usageDir, 'agent-usage.jsonl');
  const writeUsageRecord = (record: Record<string, unknown>): void => {
    mkdirSync(usageDir, { recursive: true });
    appendFileSync(
      usageFile,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        prdNumber,
        issueNumber,
        agentKind,
        model,
        ...record,
      })}\n`,
    );
  };
  const writeLog = (message: string): void => {
    console.log(message);
    if (result.logFilePath) {
      appendFileSync(result.logFilePath, `\n${message}\n`);
    }
  };

  const usage = result.iterations.flatMap((iteration, index) =>
    iteration.usage ? [{ index, ...iteration.usage }] : [],
  );

  if (usage.length === 0) {
    writeUsageRecord({
      available: false,
      iterations: result.iterations.length,
      telemetryIterations: 0,
    });
    writeLog(
      `  [#${issueNumber}] ${agentKind}:${model} usage unavailable (the provider did not return token telemetry).`,
    );
    return;
  }

  const totals = usage.reduce(
    (total, iterationUsage) => ({
      inputTokens: total.inputTokens + iterationUsage.inputTokens,
      cacheCreationInputTokens:
        total.cacheCreationInputTokens +
        iterationUsage.cacheCreationInputTokens,
      cacheReadInputTokens:
        total.cacheReadInputTokens + iterationUsage.cacheReadInputTokens,
      outputTokens: total.outputTokens + iterationUsage.outputTokens,
    }),
    {
      inputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      outputTokens: 0,
    },
  );

  writeUsageRecord({
    available: true,
    iterations: result.iterations.length,
    telemetryIterations: usage.length,
    iterationUsage: usage,
    ...totals,
  });
  writeLog(
    `  [#${issueNumber}] ${agentKind}:${model} tokens — ` +
      `input ${totals.inputTokens}, ` +
      `cache-write ${totals.cacheCreationInputTokens}, ` +
      `cache-read ${totals.cacheReadInputTokens}, ` +
      `output ${totals.outputTokens}.`,
  );
}

// ─── Preview and confirmation ─────────────────────────────────────────────────
// The plan is fully resolved by this point but nothing has been created yet, so
// this is the last moment a run can be inspected or abandoned for free.

function printPlanPreview(): void {
  console.log('Planned work:\n');
  for (const issue of slices) {
    const model = resolveModel(issue, agentKind);
    console.log(`  #${issue.number}  ${issue.title}`);
    console.log(
      `      branch ${sliceBranchFor(issue)}  ·  ${agentKind}:${model}`,
    );
  }
  console.log(
    `\n  base ${baseRef}  ·  ` +
      (integrationBranch === null
        ? 'no integration branch — each branch is its own deliverable'
        : `integrates into ${integrationBranch}`),
  );
  console.log('  Nothing is pushed to origin.\n');
}

if (dryRun) {
  printPlanPreview();
  console.log(
    'Dry run — no worktree, container, or GitHub write was performed.',
  );
  process.exit(0);
}

// PRD mode has no confirmation prompt by design — it is the AFK path. That made its
// branch handling invisible: nothing was printed before a slice branch was deleted
// and recreated. Printing the plan costs nothing and is what makes destruction
// observable. See ADR 0035.
if (mode === 'prd') {
  printPlanPreview();
}

// A sweep is the only mode where no human named the work. Everything selected here
// spends real model quota, so the set is shown and confirmed before the first
// container starts.
if (mode === 'sweep' && !assumeYes) {
  printPlanPreview();

  if (!process.stdin.isTTY) {
    fail(
      'A sweep needs confirmation, but stdin is not interactive.\n' +
        'Re-run with --dry-run to inspect the selection, or --yes to accept it.',
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question(`Dispatch these ${slices.length} issue(s)? [y/N] `)
  )
    .trim()
    .toLowerCase();
  rl.close();

  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted — nothing was dispatched.');
    process.exit(0);
  }
  console.log('');
}

console.log(`Dispatching ${slices.length} slice(s) one by one...\n`);

const results: SliceResult[] = [];
const crashed: Array<{ issue: Issue; error: string }> = [];
const pendingSlices = [...slices];

while (pendingSlices.length > 0) {
  const issue = nextReadySlice(pendingSlices);
  if (!issue) {
    for (const blockedIssue of pendingSlices) {
      const dependencies = blockedBy(blockedIssue).filter(
        (dependency) => !completedIssueNumbers.has(dependency),
      );
      const reason = `blocked by unfinished slice(s): ${dependencies
        .map((dependency) => `#${dependency}`)
        .join(', ')}`;
      console.error(`  ⚠ #${blockedIssue.number} ${reason}`);
      results.push({
        issue: blockedIssue,
        sliceBranch: sliceBranchFor(blockedIssue),
        commits: 0,
        merged: false,
        reason,
      });
    }
    break;
  }

  pendingSlices.splice(pendingSlices.indexOf(issue), 1);
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

    // Does this slice already carry a Slice Checkpoint from an interrupted run?
    // Resume is the default; destroying preserved work is the deliberate act.
    const disposition = decideSliceDisposition(inspectSliceBranch(sliceBranch));

    if (disposition === SLICE_DISPOSITIONS.skipStale) {
      // Slices stack, so a checkpoint left behind while later slices integrated is
      // based on a head that is no longer in the feature branch's history. Rebasing
      // it is a judgement call and deleting it destroys work nobody has reviewed —
      // so do neither, and say so.
      console.error(
        `  ⚠ #${issue.number} ${sliceBranch} carries a checkpoint based on a superseded ` +
          `head — skipping.\n` +
          `      Rebase it onto ${baseRef} and re-run, or discard it deliberately.\n` +
          `      Recovery: docs/sandcastle/RUNBOOK.md — "Recovering an interrupted run".`,
      );
      ghSilent([
        'issue',
        'edit',
        String(issue.number),
        '--repo',
        REPO,
        '--remove-label',
        'status:in-progress',
      ]);
      results.push({
        issue,
        sliceBranch,
        commits: 0,
        merged: false,
        reason: 'checkpoint is based on a superseded head',
      });
      continue;
    }

    const checkpoint =
      disposition === SLICE_DISPOSITIONS.resume
        ? readSliceCheckpoint(sliceBranch)
        : undefined;

    const worktreePath = join(worktreesDir, sliceBranch.replace(/\//g, '-'));

    if (checkpoint) {
      console.log(
        `  [#${issue.number}] resuming from checkpoint ${checkpoint.sha} ` +
          `(${checkpoint.files.length} file(s)) — the branch is kept, not recreated.`,
      );
      // The branch and its commits stay. Only the worktree is rebuilt, so the agent
      // gets a clean checkout of the checkpoint rather than whatever partial state
      // the interrupted container left on disk.
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
    } else {
      // Fresh slice branch + worktree off the CURRENT local feature head, so this
      // slice (processed one by one) builds on every previously-integrated slice.
      // Clear any stale branch/worktree from an earlier run first — including one
      // filed under a different type prefix, if this issue's labels have changed
      // since it last ran.
      const staleBranches = [sliceBranch, ...staleWorkBranchesFor(issue)];
      for (const stale of staleBranches) {
        const stalePath = join(worktreesDir, stale.replace(/\//g, '-'));
        if (existsSync(stalePath)) {
          spawnSync('git', ['worktree', 'remove', '--force', stalePath], {
            encoding: 'utf8',
            windowsHide: true,
          });
        }
      }
      spawnSync('git', ['worktree', 'prune'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      for (const stale of staleBranches) {
        spawnSync('git', ['branch', '-D', stale], {
          encoding: 'utf8',
          windowsHide: true,
        });
      }
      gitCmd(['branch', sliceBranch, baseRef]);
    }
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
          ...providerEnvironment(),
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
        baseBranch: baseRef,
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
      // Iterations after the first do NOT resume the agent session: each spins a
      // fresh sandbox, re-runs the dependency install, and receives the identical
      // prompt. They are cold restarts, not continuations, so an agent that failed
      // to signal completion once meets the same wall again at full price. Two buys
      // one honest retry for a transient container fault; genuine continuation is
      // the resume path, which supplies a different prompt. See ADR 0035.
      maxIterations: 2,
      // Quiet stretches (codegen, builds) can exceed the 600s default and trip the
      // idle watchdog; give long-running slices headroom.
      idleTimeoutSeconds: 1800,
      prompt: checkpoint
        ? buildResumeBrief({
            basePrompt: buildPrompt(issue, sliceBranch),
            issueNumber: issue.number,
            sliceBranch,
            checkpoint,
          })
        : buildPrompt(issue, sliceBranch),
    });

    logRunUsage(issue.number, agentKind, model, result);

    // Finalize → gate → integrate, all LOCAL. No push, no PR.
    // Standalone runs stop after the gate: with no integration branch the work
    // branch is already the deliverable, so "succeeded" means gate-passed.
    const hasWork = finalizeSliceBranch(issue, sliceBranch);
    const gatePassed = hasWork ? runSliceGate(issue, sliceBranch) : false;
    const mergeOk = !gatePassed
      ? false
      : integrationBranch === null
        ? true
        : integrateSlice(issue, sliceBranch, integrationBranch);

    if (mergeOk && integrationBranch !== null) {
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
          `Integrated into the local \`${integrationBranch}\` (fast-forward, not pushed) and closed as completed. ` +
          `It will reach \`main\` via the manual PRD PR.`,
      ]);
      unblockDependents(issue);
    } else if (mergeOk) {
      // Standalone success. The issue stays OPEN and is NOT marked status:done —
      // nothing has reached `main` yet, and marking it done here would lie about
      // work that only exists on an unpushed local branch.
      ghSilent([
        'issue',
        'edit',
        String(issue.number),
        '--repo',
        REPO,
        '--remove-label',
        'status:in-progress',
      ]);
      ghSilent([
        'issue',
        'comment',
        String(issue.number),
        '--repo',
        REPO,
        '--body',
        `Agent completed and the build gate passed. ${result.commits.length} commit(s) on the local branch \`${sliceBranch}\` (based on \`${baseRef}\`).\n` +
          `Nothing was pushed. Left open until the branch is reviewed, pushed, and merged via a PR.`,
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
        integrationBranch === null
          ? `Agent finished but ${reason}. The local branch \`${sliceBranch}\` is left in place for inspection.`
          : `Agent finished but ${reason} — slice was NOT integrated into \`${integrationBranch}\`. ` +
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
      reason: integrationBranch === null ? 'gate passed' : 'integrated',
    });
    completedIssueNumbers.add(issue.number);
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

    // Preserve BEFORE reporting: the agent's work is the expensive thing here, and
    // the next dispatch of this issue deletes the branch it lives on.
    const checkpoint = preserveInterruptedSlice(issue, sliceBranch);

    console.error(`  ✗ #${issue.number} crashed: ${String(e)}`);
    const tail = crashLogTail(issue.number);
    if (tail) {
      console.error(
        `  [#${issue.number}] the thrown error may be trailing stderr noise rather than the cause:`,
      );
      console.error(tail);
    }

    if (checkpoint) {
      console.error(
        `  [#${issue.number}] checkpoint ${checkpoint.sha} on ${sliceBranch} ` +
          `(${checkpoint.fileCount} file(s)), tagged ${checkpoint.tag}.\n` +
          `      The tag keeps this work reachable if the branch is later deleted.\n` +
          `      Recovery: docs/sandcastle/RUNBOOK.md — "Recovering an interrupted run".`,
      );
      ghSilent([
        'issue',
        'comment',
        String(issue.number),
        '--repo',
        REPO,
        '--body',
        `Agent run ended without a completion signal. Its work was preserved as a ` +
          `Slice Checkpoint \`${checkpoint.sha}\` on the local branch \`${sliceBranch}\` ` +
          `(${checkpoint.fileCount} file(s)), tagged \`${checkpoint.tag}\`.\n\n` +
          `This is local and unpushed, and it is **not** reviewed or gated — files ` +
          `present in a checkpoint do not mean a Gated Pipeline ran. See ` +
          `\`docs/sandcastle/RUNBOOK.md\` under "Recovering an interrupted run".`,
      ]);
    } else {
      console.error(
        `  [#${issue.number}] nothing to preserve — the run left no work on ${sliceBranch}.`,
      );
    }

    crashed.push({ issue, error: String(e) });
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const merged = results.filter((r) => r.merged);
const blocked = results.filter((r) => !r.merged);
const succeededVerb = integrationBranch === null ? 'ready' : 'integrated';

console.log(`\n${'─'.repeat(55)}`);
console.log(
  `Batch done: ${merged.length} ${succeededVerb}, ${blocked.length} blocked (gate/no-work), ${crashed.length} crashed.\n`,
);

for (const r of merged) {
  console.log(
    integrationBranch === null
      ? `  ✓ #${r.issue.number} ready — ${r.commits} commit(s) on ${r.sliceBranch}`
      : `  ✓ #${r.issue.number} integrated — ${r.commits} commit(s) on ${integrationBranch}`,
  );
}
for (const r of blocked) {
  console.error(`  ⚠ #${r.issue.number} NOT ${succeededVerb} — ${r.reason}`);
}
for (const r of crashed) {
  console.error(`  ✗ #${r.issue.number} crashed — ${r.error}`);
}

if (blocked.length > 0 || crashed.length > 0) {
  console.log(
    integrationBranch === null
      ? `\nThe run did not finish cleanly. Inspect the branch above, then fix and re-run.`
      : `\nOne or more slices did not integrate. Fix them and re-run — done slices are skipped.`,
  );
}
if (merged.length > 0) {
  const deliverable = integrationBranch ?? merged[0].sliceBranch;
  console.log(`\nNext step: QA the local \`${deliverable}\` branch`);
  console.log(
    integrationBranch === null
      ? `  git switch ${deliverable}   # the agent's work for this issue`
      : `  git switch ${deliverable}   # it now contains the merged slices`,
  );
  console.log(`Then push it and open ONE PR to \`main\` manually so CI runs:`);
  console.log(
    `  git push -u origin ${deliverable} && gh pr create --base main`,
  );
}

// ─── Desktop notification (best-effort; Windows / WSL2 only) ───────────────────

const runLabel = (
  mode === 'prd' ? `PRD #${prdNumber}` : `Issue #${issueNumber}`
).replace(/'/g, "''");
spawnSync(
  'powershell.exe',
  [
    '-Command',
    [
      'Add-Type -AssemblyName System.Windows.Forms;',
      `[System.Windows.Forms.MessageBox]::Show(`,
      `  '${merged.length} ${succeededVerb}, ${blocked.length} blocked, ${crashed.length} crashed.` +
        `\\n${runLabel}',`,
      `  'dispatch-agents complete', 'OK', 'Information'`,
      `)`,
    ].join(' '),
  ],
  { windowsHide: true },
);
