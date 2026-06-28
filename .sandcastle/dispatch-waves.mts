/**
 * dispatch-waves — autonomous, dependency-aware driver around dispatch-agents.
 *
 * The base orchestrator (.sandcastle/main.mts) dispatches a PRD's ready AFK slices
 * ONE BY ONE, each branched from the CURRENT local feature head, and fast-forwards
 * every finished slice into the LOCAL feature branch (no push, no PR). Within a
 * single run, a slice already sees the work of every earlier slice in that run.
 *
 * This driver adds explicit dependency ORDERING across runs: it topologically sorts
 * the PRD's slices by their `## Blocked by` sections into dependency waves, then runs
 * ONE dispatch-agents pass per wave — gating the `ready-for-agent` label so only the
 * current wave is picked up. Each wave's integrated output (on the local feature
 * branch) becomes the base for the next wave. No human interaction between waves.
 *
 * Nothing is pushed and no PRs are opened — after all waves complete you QA the
 * local feature branch, then push it and open ONE PR to `main` by hand.
 *
 * Usage: npx tsx .sandcastle/dispatch-waves.mts --prd <issue-number>
 */
import { spawnSync } from 'node:child_process';

const REPO = 'mnaimfaizy/myorganizer';

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

// ─── Parse --prd <N> ─────────────────────────────────────────────────────────

const prdFlag = process.argv.indexOf('--prd');
if (prdFlag === -1 || !process.argv[prdFlag + 1]) {
  fail('Usage: npx tsx .sandcastle/dispatch-waves.mts --prd <issue-number>');
}
const prdNumber = parseInt(process.argv[prdFlag + 1], 10);
if (isNaN(prdNumber)) fail('--prd must be a number.');

// ─── Fetch all AFK slices for this PRD ────────────────────────────────────────

type Issue = {
  number: number;
  title: string;
  labels: Array<{ name: string }>;
  body: string;
  state: string;
};

function fetchSlices(): Issue[] {
  const all = ghJson<Issue[]>([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'type:afk',
    '--state',
    'open',
    '--json',
    'number,title,labels,body,state',
    '--limit',
    '100',
  ]);
  return all.filter((i) => i.body?.includes(`PRD: #${prdNumber}`));
}

const slices = fetchSlices();
if (slices.length === 0) {
  fail(
    `No open AFK slice issues found for PRD #${prdNumber}.\n` +
      `Flip any HITL slices to type:afk, or run /to-issues ${prdNumber} first.`,
  );
}

const sliceNumbers = new Set(slices.map((s) => s.number));

// ─── Parse `## Blocked by` → dependency edges (within this PRD only) ──────────

function blockersOf(issue: Issue): number[] {
  const m = issue.body.match(/##\s*Blocked by([\s\S]*?)(?:\n##\s|$)/i);
  if (!m) return [];
  const section = m[1];
  const refs = [...section.matchAll(/#(\d+)/g)].map((x) => parseInt(x[1], 10));
  // Only count blockers that are themselves slices of this PRD.
  return refs.filter((n) => sliceNumbers.has(n) && n !== issue.number);
}

const blockers = new Map<number, number[]>();
for (const s of slices) blockers.set(s.number, blockersOf(s));

// ─── Topological sort into waves (Kahn, level by level) ───────────────────────

function computeWaves(): number[][] {
  const remaining = new Set(sliceNumbers);
  const resolved = new Set<number>();
  const waves: number[][] = [];

  while (remaining.size > 0) {
    const wave = [...remaining]
      .filter((n) => blockers.get(n)!.every((b) => resolved.has(b)))
      .sort((a, b) => a - b);

    if (wave.length === 0) {
      fail(
        `Dependency cycle or unsatisfiable blocker among slices: ${[...remaining].join(', ')}`,
      );
    }
    for (const n of wave) {
      remaining.delete(n);
      resolved.add(n);
    }
    waves.push(wave);
  }
  return waves;
}

const waves = computeWaves();

function isDone(issue: Issue): boolean {
  return issue.labels.some((l) => l.name === 'status:done');
}

// ─── Plan summary ─────────────────────────────────────────────────────────────

const byNumber = new Map(slices.map((s) => [s.number, s]));
console.log(`\nPRD #${prdNumber} — autonomous wave dispatch`);
console.log(`${waves.length} wave(s), ${slices.length} slice(s):\n`);
waves.forEach((wave, i) => {
  const labels = wave
    .map((n) => `#${n}${isDone(byNumber.get(n)!) ? ' (done)' : ''}`)
    .join(', ');
  console.log(`  Wave ${i + 1}: ${labels}`);
});
console.log();

if (process.argv.includes('--plan')) {
  console.log('--plan: preview only, no slices dispatched.\n');
  process.exit(0);
}

// ─── Run each wave ─────────────────────────────────────────────────────────────

for (let i = 0; i < waves.length; i++) {
  const wave = waves[i];
  // Re-fetch to pick up status changes from prior waves / prior runs.
  const current = fetchSlices();
  const currentByNumber = new Map(current.map((s) => [s.number, s]));

  const openInWave = wave.filter((n) => {
    const issue = currentByNumber.get(n);
    return issue && !isDone(issue);
  });

  if (openInWave.length === 0) {
    console.log(`\n=== Wave ${i + 1} — already complete, skipping. ===`);
    continue;
  }

  console.log(
    `\n=== Wave ${i + 1}/${waves.length}: dispatching ${openInWave
      .map((n) => `#${n}`)
      .join(', ')} ===\n`,
  );

  // Gate labels: ONLY this wave's open slices are ready-for-agent. Remove the
  // label from every other PRD slice (future waves AND already-done slices) so
  // the orchestrator's open+ready+afk filter cannot re-dispatch them.
  for (const s of current) {
    const wantReady = openInWave.includes(s.number);
    const hasReady = s.labels.some((l) => l.name === 'ready-for-agent');
    if (wantReady && !hasReady) {
      ghSilent([
        'issue',
        'edit',
        String(s.number),
        '--repo',
        REPO,
        '--add-label',
        'ready-for-agent',
      ]);
    } else if (!wantReady && hasReady) {
      ghSilent([
        'issue',
        'edit',
        String(s.number),
        '--repo',
        REPO,
        '--remove-label',
        'ready-for-agent',
      ]);
    }
  }

  // Invoke the existing orchestrator. It branches each ready slice from the
  // (now updated) local feature branch, runs the agent, and fast-forwards the
  // slice into the local feature branch.
  const dispatch = spawnSync(
    'npx',
    ['tsx', '.sandcastle/main.mts', '--prd', String(prdNumber)],
    { encoding: 'utf8', stdio: 'inherit', windowsHide: true, shell: true },
  );
  if (dispatch.status !== 0) {
    fail(
      `Wave ${i + 1} orchestrator exited with code ${dispatch.status}. ` +
        `Inspect the feature branch and slice issues before re-running.`,
    );
  }

  // Verify every slice in this wave reached status:done before proceeding —
  // a dependent wave must not branch off an incomplete base.
  const after = fetchSlices();
  const afterByNumber = new Map(after.map((s) => [s.number, s]));
  const failedSlices = openInWave.filter((n) => {
    const issue = afterByNumber.get(n);
    return !issue || !isDone(issue);
  });

  if (failedSlices.length > 0) {
    fail(
      `Wave ${i + 1} did not fully complete. Incomplete: ${failedSlices
        .map((n) => `#${n}`)
        .join(', ')}.\n` +
        `These slices block later waves. Fix them, then re-run — completed ` +
        `waves are detected via status:done and skipped automatically.`,
    );
  }

  console.log(`\n=== Wave ${i + 1} complete. ===`);
}

console.log(`\n${'─'.repeat(55)}`);
console.log(`All ${waves.length} waves complete for PRD #${prdNumber}.`);
console.log(
  `The local feature branch now contains every slice. QA it, then push it and\n` +
    `open ONE PR to main by hand:  git push -u origin <feature-branch> && gh pr create --base main\n`,
);
