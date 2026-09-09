#!/usr/bin/env node
// Reports how much of an obligation worklist the reviewer actually answered.
//
//   node tools/scripts/review/check-obligation-answers.mjs <worklist.json> <answers.json> [--out <report.json>]
//
// This never fails a review. An unanswered obligation is a fact about the
// review's thoroughness — neither a fact about the pipeline nor a judgment
// about the diff (ADR 0073), and the finding contract is untouched by it
// (ADR 0071: a report is accepted or rejected whole, so a malformed answer
// sheet must not be able to take the findings down with it).
//
// What it buys is a split that did not exist before. A missed defect used to
// look the same whatever caused it; now it reads as one of three:
//
//   not selected      -> the trigger is wrong. Fix the pattern; it is cheap.
//   selected, unanswered -> the forcing function is too weak.
//   answered, no finding -> a capability limit, and now known to be one.
//
// Exit 0 always when it could run, whatever the answers say.
// Exit 2 = the script could not run (missing file, unreadable JSON, bad shape).
import { writeFileSync } from 'node:fs';
import { ZodError } from 'zod';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import { AnswerSheetSchema, checkAnswers } from './obligations.mjs';
import { formatIssues } from './schema.mjs';

const USAGE =
  'usage: check-obligation-answers.mjs <worklist.json> <answers.json> [--out <path>]';

export const main = (argv) => {
  const bail = cannotRun('review-obligations-check');
  const { positional, flags } = parseArgs(argv);
  const [worklistPath, answersPath] = positional;
  if (!worklistPath || !answersPath) bail(USAGE);
  if ('out' in flags && !flags.out) bail('--out needs a path');

  const worklist = readJsonOr(worklistPath, bail);
  if (!Array.isArray(worklist?.selected))
    bail(`${worklistPath}: not an obligation worklist`);

  let sheet;
  try {
    sheet = AnswerSheetSchema.parse(readJsonOr(answersPath, bail));
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    // Exit 2, not 1: a malformed sheet means this script could not measure
    // anything. It is never the reason a review is rejected.
    console.error('review-obligations-check: answer sheet unreadable');
    for (const line of formatIssues(err)) console.error(`  ${line}`);
    process.exit(2);
  }

  const report = checkAnswers(worklist, sheet);
  const summary =
    report.expected === 0
      ? 'no obligation fired on this diff'
      : `${report.answered} of ${report.expected} site(s) answered` +
        (report.incomplete.length
          ? `, ${report.incomplete.length} missing field(s)`
          : '') +
        (report.unexpected.length
          ? `, ${report.unexpected.length} unexpected`
          : '');
  console.log(`review-obligations-check: ${summary}`);
  for (const u of report.unanswered)
    console.log(`  unanswered: ${u.id} at ${u.site.file}:${u.site.line}`);
  for (const i of report.incomplete)
    console.log(`  incomplete: ${i.key} missing ${i.missing.join(', ')}`);

  if (flags.out)
    writeFileSync(flags.out, `${JSON.stringify(report, null, 2)}\n`);
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
