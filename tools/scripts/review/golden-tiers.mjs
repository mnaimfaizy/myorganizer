#!/usr/bin/env node
// The golden set's tier filter (ADR 0072), and the only implementation of it.
//
//   node tools/scripts/review/golden-tiers.mjs [--tier guard|frontier|all]
//
// Prints the case ids of one tier as a JSON array — the replay workflow's
// matrix. `all`, or no `--tier`, prints every case.
//
// This file exists because the filter was briefly written twice: once as a
// jq expression in review-golden-replay.yml and once as `--list --tier` in
// score-golden-case.mjs, and they disagreed about the word "all". The jq
// version was there because the workflow's `cases` job installs nothing and
// the scorer reaches schema.mjs, which imports zod. So the constraint is
// real: whatever the workflow calls must have no third-party imports.
//
// Nothing here imports anything but `node:fs`. Keep it that way, and keep
// this the single place that decides which cases a tier contains.
//
// Exit 0 = printed. Exit 2 = could not run.
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

const main = (argv) => {
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
