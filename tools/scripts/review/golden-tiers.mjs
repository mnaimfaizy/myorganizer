#!/usr/bin/env node
// The golden set's tier filter (ADR 0072), and the only implementation of it.
//
//   node tools/scripts/review/golden-tiers.mjs [--tier guard|frontier|all]
//   node tools/scripts/review/golden-tiers.mjs --scheduled
//
// Prints the case ids of one tier as a JSON array — the replay workflow's
// matrix. `all`, or no `--tier`, prints every case. `--scheduled` prints the
// tier this week's scheduled replay runs, or an empty line for none, from
// the git history of the reviewer's inputs (ADR 0109).
//
// This file exists because the filter was briefly written twice: once as a
// jq expression in review-golden-replay.yml and once as `--list --tier` in
// score-golden-case.mjs, and they disagreed about the word "all". The jq
// version was there because the workflow's `cases` job installs nothing and
// the scorer reaches schema.mjs, which imports zod. So the constraint is
// real: whatever the workflow calls must have no third-party imports.
//
// Nothing here imports anything but Node built-ins. Keep it that way, and keep
// this the single place that decides which cases a tier contains.
//
// Exit 0 = printed. Exit 2 = could not run.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const GOLDEN_SET_PATH = 'tools/config/review-golden-set.json';

/** The tiers a case may declare, plus the pseudo-tier meaning "every case". */
export const CASE_TIERS = ['guard', 'frontier'];
export const ALL_TIERS = 'all';

/**
 * @param {{cases: {id: string, tier: string}[]}} set
 * @param {string} [tier] one of CASE_TIERS, or ALL_TIERS / undefined for every case
 * @returns {string[]} case ids, in the set's own order
 */
export const caseIdsInTier = (set, tier) => {
  if (tier && tier !== ALL_TIERS && !CASE_TIERS.includes(tier))
    throw new Error(
      `tier must be one of ${[...CASE_TIERS, ALL_TIERS].join(', ')}, got ${tier}`,
    );
  const cases = set?.cases ?? [];
  return cases
    .filter((c) => !tier || tier === ALL_TIERS || c.tier === tier)
    .map((c) => c.id);
};

/**
 * What a replay measures, as git pathspecs: everything that produces a review,
 * and the harness the replay lays over each case tree (ADR 0102). The
 * scheduled replay runs only when one of these moved (ADR 0109). A path left
 * off here is a reviewer change that waits up to a month to be measured.
 */
export const REPLAY_INPUT_PATHS = [
  '.agents/skills/code-review',
  'tools/scripts/review',
  '.github/actions/code-reviewer',
  '.github/workflows/code-review.yml',
  '.github/workflows/review-golden-replay.yml',
  'tools/config/review-golden-set.json',
  'tools/config/review-obligations.json',
  'tools/config/review-rules.json',
  '.claude',
  'tools/scripts/copilot-hooks',
  '.agents/skills/upstream-brief',
];

/** How far back each scheduled tier looks for a changed input (ADR 0109). */
export const FRONTIER_LOOKBACK_DAYS = 7;
export const GUARD_LOOKBACK_DAYS = 31;

export const isFirstWeekOfMonth = (date) => date.getUTCDate() <= 7;

/**
 * The tier a weekly scheduled replay runs, or null for none (ADR 0109).
 * Frontier weekly when an input moved that week; every case in the first week
 * of a month in which an input moved; nothing when the reviewer did not move,
 * because re-measuring an untouched reviewer is the spend the schedule removes.
 */
export const scheduledTier = ({
  changedInWeek,
  changedInMonth,
  firstWeekOfMonth,
}) => {
  if (firstWeekOfMonth && changedInMonth) return ALL_TIERS;
  if (changedInWeek) return 'frontier';
  return null;
};

const inputsChangedSince = (days, now) => {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const out = execFileSync(
    'git',
    [
      'log',
      `--since=${since}`,
      '--format=%H',
      'HEAD',
      '--',
      ...REPLAY_INPUT_PATHS,
    ],
    { encoding: 'utf8' },
  );
  return out.trim() !== '';
};

const scheduledMain = (now) => {
  const tier = scheduledTier({
    changedInWeek: inputsChangedSince(FRONTIER_LOOKBACK_DAYS, now),
    changedInMonth: inputsChangedSince(GUARD_LOOKBACK_DAYS, now),
    firstWeekOfMonth: isFirstWeekOfMonth(now),
  });
  process.stdout.write(`${tier ?? ''}\n`);
};

const main = (argv) => {
  if (argv.includes('--scheduled')) {
    try {
      scheduledMain(new Date());
    } catch (err) {
      process.stderr.write(`golden-tiers: ${err.message}\n`);
      process.exit(2);
    }
    return;
  }
  const i = argv.indexOf('--tier');
  const tier = i === -1 ? undefined : argv[i + 1];
  try {
    const set = JSON.parse(readFileSync(GOLDEN_SET_PATH, 'utf8'));
    process.stdout.write(`${JSON.stringify(caseIdsInTier(set, tier))}\n`);
  } catch (err) {
    process.stderr.write(`golden-tiers: ${err.message}\n`);
    process.exit(2);
  }
};

// `isMain` lives in cli.mjs, which reaches schema.mjs and zod; this file
// cannot import it, so the check is inlined against the builtin URL helper
// rather than by comparing basenames, which two same-named scripts would
// both satisfy.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2));
