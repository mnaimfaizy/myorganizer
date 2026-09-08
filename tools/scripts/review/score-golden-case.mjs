#!/usr/bin/env node
// Scores one golden replay (ADR 0071, Consequences): did the reviewer, run
// against a case's historical range with today's skill and tooling, raise
// the findings the incident says it should have?
//
//   node tools/scripts/review/score-golden-case.mjs --case <id> \
//     --normalized <normalized.json> [--out <score.json>]
//
//   node tools/scripts/review/score-golden-case.mjs --list [--tier <tier>]
//   node tools/scripts/review/score-golden-case.mjs --show <id>
//
// `--list` prints the case ids (the replay workflow's matrix), optionally
// narrowed to one tier (ADR 0072); `--show` prints the facts the reviewer
// prompt needs for one case as JSON.
//
// Exit 0 = recall at or above the case's minimum. Exit 1 = below it.
// Exit 2 = could not run.
import { appendFileSync, writeFileSync } from 'node:fs';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import { loadGoldenSet, renderScore, scoreCase } from './golden.mjs';
import { caseIdsInTier } from './golden-tiers.mjs';

export const main = (argv) => {
  const bail = cannotRun('review-golden');
  const { flags } = parseArgs(argv);
  const set = loadGoldenSet();

  if ('list' in flags) {
    // `--list --tier frontier` is the replay matrix for an ordinary push;
    // `--tier guard` is the narrower one (ADR 0072). `all`, or no --tier,
    // lists everything. The filter itself is golden-tiers.mjs and only
    // golden-tiers.mjs: the replay workflow cannot call this script (its
    // `cases` job installs nothing, and the import above reaches zod), so
    // the one thing both callers must agree on lives where both can reach.
    try {
      const tier = typeof flags.tier === 'string' ? flags.tier : undefined;
      process.stdout.write(`${JSON.stringify(caseIdsInTier(set, tier))}\n`);
    } catch (err) {
      bail(err.message);
    }
    return;
  }
  if (flags.show) {
    const c = set.cases.find((x) => x.id === flags.show);
    if (!c) bail(`no case ${flags.show}`);
    process.stdout.write(`${JSON.stringify(c, null, 2)}\n`);
    return;
  }
  if (!flags.case || !flags.normalized)
    bail('--case <id> and --normalized <normalized.json> are required');
  const goldenCase = set.cases.find((c) => c.id === flags.case);
  if (!goldenCase) bail(`no case ${flags.case}`);

  const normalized = readJsonOr(flags.normalized, bail);
  if (!Array.isArray(normalized.findings) || !normalized.verdict)
    bail(`${flags.normalized} is not a normalized report`);

  const score = scoreCase(goldenCase, normalized);
  const markdown = renderScore(goldenCase, score);
  if (flags.out)
    writeFileSync(flags.out, `${JSON.stringify(score, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  process.stdout.write(markdown);
  process.exit(score.pass ? 0 : 1);
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
