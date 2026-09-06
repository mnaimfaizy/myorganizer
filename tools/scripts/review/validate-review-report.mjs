#!/usr/bin/env node
// Validates a `/code-review` report and writes its normalized form (ADR 0070).
//
//   node tools/scripts/review/validate-review-report.mjs <report.json> [--out <normalized.json>]
//
// A report is accepted whole or rejected whole. On rejection every schema
// issue is printed, one per line, and nothing is written — a partial verdict
// is the thing this script exists to refuse. The normalized file carries the
// derived finding ids, the computed verdict, and the effective tier; it is
// what the renderer and the poster read.
//
// Exit 0 = valid, normalized report written or printed.
// Exit 1 = invalid report (the reviewer's output does not meet the contract).
// Exit 2 = the script could not run (missing file, unreadable JSON).
import { writeFileSync } from 'node:fs';
import { ZodError } from 'zod';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import { formatIssues, normalizeReport } from './schema.mjs';

const USAGE = 'usage: validate-review-report.mjs <report.json> [--out <path>]';

export const main = (argv) => {
  const bail = cannotRun('review-validate');
  const { positional, flags } = parseArgs(argv);
  const [inputPath] = positional;
  if (!inputPath) bail(USAGE);
  if ('out' in flags && !flags.out) bail('--out needs a path');

  const raw = readJsonOr(inputPath, bail);

  let normalized;
  try {
    normalized = normalizeReport(raw);
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    console.error('review-validate: report rejected');
    for (const line of formatIssues(err)) console.error(`  ${line}`);
    process.exit(1);
  }

  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  if (flags.out) {
    writeFileSync(flags.out, text);
    console.log(
      `review-validate: ${normalized.findings.length} finding(s), verdict ${normalized.verdict}, written to ${flags.out}`,
    );
  } else {
    process.stdout.write(text);
  }
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
