#!/usr/bin/env node
// Appends one line to the golden replay results record (issue #932): one
// line per case run, including voids, which are recorded as voids and never
// as misses or catches (ADR 0101).
//
//   node tools/scripts/review/record-golden-result.mjs --out <file> \
//     --date <YYYY-MM-DD> --run-id <id> --commit <sha> --case <id> \
//     --outcome caught|missed|void [--void-reason <reason>] \
//     [--recall <0..1>] --model <id> [--total-cost-usd <n>] [--turns <n>]
//
// Exit 0 = appended. Exit 2 = the record would be invalid.
import { cannotRun, isMain, parseArgs } from './cli.mjs';
import { appendResultLine } from './golden-results.mjs';

const toNumberOrNull = (v) =>
  v === undefined || v === null ? null : Number(v);

export const main = (argv) => {
  const bail = cannotRun('record-golden-result');
  const { flags } = parseArgs(argv);
  if (!flags.out) bail('--out <file> is required');

  try {
    const record = appendResultLine(flags.out, {
      date: flags.date,
      runId: flags['run-id'],
      commit: flags.commit,
      caseId: flags.case,
      outcome: flags.outcome,
      voidReason: flags['void-reason'] ?? null,
      recall: toNumberOrNull(flags.recall),
      totalCostUsd: toNumberOrNull(flags['total-cost-usd']),
      turns: toNumberOrNull(flags.turns),
      model: flags.model,
    });
    console.log(
      `record-golden-result: appended ${JSON.stringify(record)} to ${flags.out}`,
    );
  } catch (err) {
    bail(err.message);
  }
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
