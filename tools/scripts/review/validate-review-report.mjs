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
import { readFileSync, writeFileSync } from 'node:fs';
import { ZodError } from 'zod';

import { formatIssues, normalizeReport } from './schema.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex === -1 ? null : args[outIndex + 1];
const inputPath = args.find(
  (a, i) => !a.startsWith('--') && (outIndex === -1 || i !== outIndex + 1),
);

const cannotRun = (msg) => {
  console.error(`review-validate: ${msg}`);
  process.exit(2);
};

if (!inputPath)
  cannotRun('usage: validate-review-report.mjs <report.json> [--out <path>]');
if (outIndex !== -1 && !outPath) cannotRun('--out needs a path');

let raw;
try {
  raw = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  cannotRun(`cannot read ${inputPath}: ${err.message}`);
}

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
if (outPath) {
  writeFileSync(outPath, text);
  console.log(
    `review-validate: ${normalized.findings.length} finding(s), verdict ${normalized.verdict}, written to ${outPath}`,
  );
} else {
  process.stdout.write(text);
}
