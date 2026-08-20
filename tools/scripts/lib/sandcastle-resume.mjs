/**
 * Pure decision logic for resuming an Interrupted Slice.
 *
 * Kept out of `.sandcastle/main.mts` so it can be tested without Docker, git, a
 * network, or a five-hour wait for a real provider limit. The orchestrator stays
 * orchestration; every judgement it makes about a checkpoint is decided here from
 * explicit inputs.
 *
 * Run the tests with: yarn sandcastle:resume:test
 *
 * See docs/adr/0035-interrupted-slices-resume-from-git-and-destruction-is-deliberate.md.
 * Decisions recorded there are settled — this module implements them, it does not
 * revisit them.
 */

/**
 * What the orchestrator should do with a slice branch it is about to dispatch.
 *
 * - `resume`     — a usable Slice Checkpoint is present; continue from it.
 * - `fresh`      — delete and recreate the branch from the base ref (today's behaviour).
 * - `skip-stale` — a checkpoint exists but is based on a superseded head. Report it
 *                  and leave the branch alone: rebasing is the human's call, and
 *                  deleting would destroy work the maintainer has not seen.
 */
export const SLICE_DISPOSITIONS = Object.freeze({
  resume: 'resume',
  fresh: 'fresh',
  skipStale: 'skip-stale',
});

/**
 * Decide how to treat a slice branch.
 *
 * @param {object} input
 * @param {boolean} input.branchExists          Does the slice branch exist at all?
 * @param {number}  input.commitsAhead          Commits on the branch beyond the base ref.
 * @param {boolean} input.mergeBaseMatchesBase  Is merge-base(branch, base) === base?
 * @param {boolean} [input.discardRequested]    Did the maintainer pass the discard flag?
 * @returns {'resume'|'fresh'|'skip-stale'}
 */
export function decideSliceDisposition({
  branchExists,
  commitsAhead,
  mergeBaseMatchesBase,
  discardRequested = false,
}) {
  // An explicit discard outranks everything. The maintainer has looked at the work
  // and judged it worthless; this is the only path that destroys a checkpoint.
  if (discardRequested) return SLICE_DISPOSITIONS.fresh;

  // No branch, or a branch with nothing on it, is not a checkpoint. Recreating it is
  // both correct and what happens today.
  if (!branchExists) return SLICE_DISPOSITIONS.fresh;
  if (!Number.isFinite(commitsAhead) || commitsAhead <= 0) {
    return SLICE_DISPOSITIONS.fresh;
  }

  // Slices stack: each is cut from the live feature head so it builds on every
  // integrated predecessor. A checkpoint left behind while later slices integrated is
  // based on a head that no longer exists in the feature branch's history, so it can
  // neither fast-forward nor be safely built on.
  if (!mergeBaseMatchesBase) return SLICE_DISPOSITIONS.skipStale;

  return SLICE_DISPOSITIONS.resume;
}

/**
 * The five guardrails a resumed agent is held to.
 *
 * An interrupted agent stops mid-thought, so whatever it left behind is unreviewed by
 * construction — the run died before any reviewer saw it. These exist to stop a fresh
 * agent reading that output as finished work.
 */
export const RESUME_GUARDRAILS = Object.freeze([
  'The checkpoint is a checkpoint, NOT approved work. Audit it before you extend it.',
  'Do NOT reset, rebase, or amend the checkpoint commit. It is the maintainer’s anchor for diffing what the interrupted run produced. Correct it FORWARD with normal commits.',
  'Do NOT restart from scratch and do NOT revert files wholesale. If part of the checkpoint is wrong, change it forward and say why.',
  'Report your inventory BEFORE your first edit: which acceptance criteria are met, which are partial, and which are untouched.',
  'Files present in the checkpoint do NOT satisfy a Gated Pipeline. A spec file already in the tree does not mean TestScaffold ran, was reviewed, or passed — route it through the pipelines named above regardless.',
]);

/**
 * Build the brief for a resumed slice.
 *
 * Takes the prompt the slice would normally receive and prepends the checkpoint
 * context plus the audit-first instruction. The diff itself is deliberately NOT
 * inlined: the agent can read it from git in one command, and spending the context
 * budget on it defeats the point of resuming rather than restarting.
 *
 * @param {object} input
 * @param {string}   input.basePrompt      The prompt this slice would normally get.
 * @param {number}   input.issueNumber
 * @param {string}   input.sliceBranch
 * @param {object}   input.checkpoint
 * @param {string}   input.checkpoint.sha
 * @param {string[]} [input.checkpoint.files]
 * @returns {string}
 */
export function buildResumeBrief({
  basePrompt,
  issueNumber,
  sliceBranch,
  checkpoint,
}) {
  const files = checkpoint.files ?? [];
  const inventory =
    files.length > 0
      ? files.map((file) => `  - ${file}`).join('\n')
      : '  (file list unavailable — read it with `git show --stat`)';

  return [
    `## RESUMING an interrupted attempt — read this before anything else`,
    ``,
    `A previous agent run on issue #${issueNumber} was interrupted before it signalled`,
    `completion. Its work was preserved as a Slice Checkpoint on your branch:`,
    ``,
    `  branch     ${sliceBranch}`,
    `  checkpoint ${checkpoint.sha}`,
    `  files      ${files.length || 'unknown'}`,
    ``,
    inventory,
    ``,
    `Inspect it with \`git show ${checkpoint.sha}\` and \`git show --stat ${checkpoint.sha}\`.`,
    ``,
    `### Rules for this run`,
    ``,
    ...RESUME_GUARDRAILS.map(
      (guardrail, index) => `${index + 1}. ${guardrail}`,
    ),
    ``,
    `Your FIRST output must be the inventory required by rule 4. Only then start work.`,
    ``,
    `---`,
    ``,
    basePrompt,
  ].join('\n');
}

// ─── Discarding a checkpoint ──────────────────────────────────────────────────
// Resume is the default, so destroying preserved work needs an argument. These
// helpers decide whether that argument was given and whether it was given somewhere
// it is allowed to apply.

/** The flag that discards a Slice Checkpoint instead of resuming from it. */
export const DISCARD_FLAG = '--fresh';

/** @param {string[]} argv */
export function isDiscardRequested(argv) {
  return argv.includes(DISCARD_FLAG);
}

/**
 * A discard is a surgical instruction about ONE attempt a maintainer has inspected
 * and judged worthless. Applied to a whole PRD it becomes "destroy any checkpoint you
 * encounter", which is the blast radius resume exists to remove — so in PRD mode the
 * flag is only accepted alongside the per-slice targeting that already exists.
 *
 * @param {object} input
 * @param {boolean} input.discardRequested
 * @param {'prd'|'issue'|'sweep'} input.mode
 * @param {number} [input.issueNumber]  The `--issue` target, when one was given.
 * @returns {{ ok: boolean, message: string }}  `message` is empty when ok.
 */
export function validateDiscardScope({ discardRequested, mode, issueNumber }) {
  if (!discardRequested) return { ok: true, message: '' };

  if (mode === 'prd' && issueNumber === undefined) {
    return {
      ok: false,
      message:
        `${DISCARD_FLAG} discards preserved work, so it must name the slice it applies to.\n` +
        `Re-run with the slice targeted:  --prd <n> --issue <slice> ${DISCARD_FLAG}`,
    };
  }

  if (mode === 'sweep') {
    return {
      ok: false,
      message:
        `${DISCARD_FLAG} is not accepted in sweep mode — a sweep selects work nobody named,\n` +
        `so a blanket discard would destroy checkpoints you have never seen.\n` +
        `Discard one issue at a time:  --issue <n> ${DISCARD_FLAG}`,
    };
  }

  return { ok: true, message: '' };
}

/**
 * Decide what the wave driver forwards to the orchestrator.
 *
 * The wave driver is a bulk unattended pass across an entire PRD, so it refuses the
 * discard flag outright rather than forwarding it: composing "discard" with "every
 * slice in this PRD" is exactly the blast radius this feature removes. Everything the
 * driver does not own itself still forwards untouched.
 *
 * @param {string[]} argv  Full process argv.
 * @returns {{ ok: boolean, message: string, forwarded: string[] }}
 */
export function planWaveForwarding(argv) {
  if (isDiscardRequested(argv)) {
    return {
      ok: false,
      forwarded: [],
      message:
        `${DISCARD_FLAG} is not accepted by the wave driver.\n` +
        `It discards preserved work, and a wave run spans every slice in the PRD — so it\n` +
        `would destroy checkpoints across the whole feature, not the one you meant.\n\n` +
        `Discard the single attempt you inspected, then re-run the waves:\n` +
        `  npx tsx .sandcastle/main.mts --prd <n> --issue <slice> ${DISCARD_FLAG}\n` +
        `  npx tsx .sandcastle/dispatch-waves.mts --prd <n>`,
    };
  }

  const forwarded = [];
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    // --prd and --plan are the driver's own; everything else belongs downstream.
    if (arg === '--prd') {
      index += 1;
      continue;
    }
    if (arg === '--plan') continue;
    forwarded.push(arg);
  }

  return { ok: true, message: '', forwarded };
}

// ─── Provider usage limits ────────────────────────────────────────────────────
// This orchestrator dispatches three different agents, so "did we hit a usage limit"
// cannot be one hardcoded string match. Each provider contributes its own matchers;
// a provider with none classifies as `unknown`, which is the correct answer rather
// than a gap — their message formats are not ours to guess, and a wrong guess is
// worse than no guess because it can trigger a multi-hour sleep.
//
// The thrown agent error is NOT the input. It carries whatever was last on stderr,
// routinely a trailing warning rather than the cause. The log tail is.

export const LIMIT_CLASSIFICATIONS = Object.freeze({
  limitHit: 'limit-hit',
  other: 'other',
  unknown: 'unknown',
});

/**
 * Per-provider matchers over a log tail.
 *
 * Claude Code is the only provider whose limit message we have observed. Cursor and
 * Copilot intentionally have none: add a matcher when a real message is captured,
 * never a guessed one.
 */
export const LIMIT_MATCHERS = Object.freeze({
  claude: Object.freeze([
    /you've hit your (?:session|usage) limit/i,
    /\bsession limit reached\b/i,
    /\busage limit reached\b/i,
  ]),
  cursor: Object.freeze([]),
  copilot: Object.freeze([]),
});

/**
 * Marker sandcastle writes when a run begins. A slice log is APPENDED to across runs,
 * so this is what separates them.
 */
export const RUN_START_MARKER = '--- Run started:';

/**
 * The last `count` non-empty lines of the CURRENT run in a slice log.
 *
 * Scoping to the current run is not a nicety. Slice logs accumulate: re-dispatching
 * an issue appends to the same file, so a plain tail-of-file can reach back past the
 * run boundary and classify the PREVIOUS run's ending as this one's. That produced a
 * real misfire — a dependency-install failure was read as a usage limit because the
 * prior run's limit message was still within 15 lines of the end — and parked a run
 * for roughly twenty hours.
 *
 * When no marker is present the whole file is used, which is correct for a
 * single-run log. `boundMaxWait` covers the case where the marker format changes.
 */
export function tailLines(contents, count = 15) {
  const text = String(contents ?? '');
  const lastRunStart = text.lastIndexOf(RUN_START_MARKER);
  const currentRun = lastRunStart === -1 ? text : text.slice(lastRunStart);

  return currentRun
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .slice(-count);
}

/**
 * Parse a reset time out of a limit message.
 *
 * Returns undefined whenever the text cannot be read with confidence. That is
 * load-bearing: the wait policy refuses to sleep without a parsed time rather than
 * guessing a window, because a wrong guess either wastes hours or wakes into the
 * same wall and burns a retry.
 *
 * @param {string} text
 * @param {Date} now
 * @returns {Date|undefined}
 */
export function parseResetTime(text, now) {
  // Observed shape: "resets 4:30am (UTC)". Only UTC is accepted — a bare local time
  // would be ambiguous across the machines this runs on.
  const match =
    /resets\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(UTC\)/i.exec(
      String(text ?? ''),
    );
  if (!match) return undefined;

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3].toLowerCase();

  if (hour < 1 || hour > 12 || minute > 59) return undefined;
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  const reset = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0,
    ),
  );
  // A reset time already past today refers to tomorrow.
  if (reset.getTime() <= now.getTime()) {
    reset.setUTCDate(reset.getUTCDate() + 1);
  }
  return reset;
}

/**
 * Classify why a run ended, from the tail of its log.
 *
 * @param {object} input
 * @param {'claude'|'cursor'|'copilot'} input.agentKind
 * @param {string[]} input.logTail  Already tailed — see tailLines.
 * @param {Date} input.now
 * @returns {{ kind: string, resetAt: Date|undefined, evidence: string|undefined }}
 */
export function classifyRunFailure({ agentKind, logTail, now }) {
  const matchers = LIMIT_MATCHERS[agentKind];

  // A provider we have no matchers for is `unknown`, never `other`: the difference is
  // "we did not look" versus "we looked and it was not a limit".
  if (!matchers || matchers.length === 0) {
    return {
      kind: LIMIT_CLASSIFICATIONS.unknown,
      resetAt: undefined,
      evidence: undefined,
    };
  }

  const lines = Array.isArray(logTail) ? logTail : [];
  for (const line of lines) {
    if (matchers.some((matcher) => matcher.test(line))) {
      return {
        kind: LIMIT_CLASSIFICATIONS.limitHit,
        resetAt: parseResetTime(line, now),
        evidence: line.trim(),
      };
    }
  }

  return {
    kind: LIMIT_CLASSIFICATIONS.other,
    resetAt: undefined,
    evidence: undefined,
  };
}

/** How many times one run may wait out a provider limit before giving up. */
export const MAX_QUOTA_WAITS = 2;

/**
 * The furthest ahead a reset time may plausibly be before we refuse to trust it.
 *
 * A provider's usage window is measured in hours, so a reset further out than this
 * means something is wrong — a stale message from an earlier run, a truncated line, a
 * changed format — and sleeping on it wastes most of a day. Independent of how the
 * classification was reached, so it still holds if the run-boundary scoping above
 * fails for a reason we have not thought of.
 */
export const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

/**
 * Decide whether to park the run until a limit resets, or exit with the work
 * preserved.
 *
 * @param {object} input
 * @param {{kind: string, resetAt: Date|undefined}} input.classification
 * @param {boolean} input.waitEnabled   Did the maintainer opt in?
 * @param {number}  input.waitsTaken    Waits already spent this run.
 * @param {Date}    [input.now]
 * @param {number}  [input.maxWaits]
 * @param {number}  [input.maxWaitMs]   Reject a reset further ahead than this.
 * @returns {{ action: 'wait'|'exit', until: Date|undefined, reason: string }}
 */
export function decideWaitPolicy({
  classification,
  waitEnabled,
  waitsTaken,
  now = new Date(),
  maxWaits = MAX_QUOTA_WAITS,
  maxWaitMs = MAX_WAIT_MS,
}) {
  const exit = (reason) => ({ action: 'exit', until: undefined, reason });

  if (!waitEnabled) return exit('waiting was not requested');

  if (classification.kind !== LIMIT_CLASSIFICATIONS.limitHit) {
    return exit(
      classification.kind === LIMIT_CLASSIFICATIONS.unknown
        ? 'this provider reports no limit format we recognise'
        : 'the run did not end on a provider limit',
    );
  }

  // Never sleep blind. An unreadable timestamp means the format changed or the
  // message was truncated; guessing a window is worse than stopping.
  if (!(classification.resetAt instanceof Date)) {
    return exit('the reset time could not be read from the limit message');
  }

  if (waitsTaken >= maxWaits) {
    return exit(`the wait limit of ${maxWaits} for this run is exhausted`);
  }

  // Sanity-bound the window. A reset further out than a provider's usage window is
  // not believable, and the cost of trusting it is most of a day parked for nothing.
  const untilMs = classification.resetAt.getTime() - now.getTime();
  if (untilMs > maxWaitMs) {
    return exit(
      `the reset time is ${Math.round(untilMs / 3_600_000)}h away, further than the ` +
        `${Math.round(maxWaitMs / 3_600_000)}h bound — treating it as not trustworthy`,
    );
  }

  return {
    action: 'wait',
    until: classification.resetAt,
    reason: `provider limit resets at ${classification.resetAt.toISOString()}`,
  };
}
