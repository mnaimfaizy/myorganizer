#!/usr/bin/env node
// Asserts that the golden replay ledger's generated Runs section matches
// docs/review/golden-replay-results.jsonl — the results record every replay
// case run appends a line to, including voids (issue #932, ADR 0101).
//
//   node tools/scripts/check-review-golden-results.mjs [--print]
//
// The record is the source; the ledger's generated section (between the
// GENERATED:golden-runs markers) is rendered from it. Historical rows above
// the markers are hand-written and untouched by this check — the generated
// section starts from the first recorded line, the same shape as the other
// generated-page checks (review:pages:check, agents:map:check): generate
// from source, diff against what is committed, fail on drift.
//
// --print renders the expected section without comparing, so a maintainer
// can copy it between the markers by hand.
//
// Exit 0 = in sync. Exit 1 = drift. Exit 2 = the check could not run.
import { existsSync, readFileSync } from 'node:fs';

import {
  GENERATED_END,
  GENERATED_START,
  GoldenResultError,
  parseResultsFile,
  renderRunsTable,
} from './review/golden-results.mjs';

const RECORD = 'docs/review/golden-replay-results.jsonl';
const LEDGER = 'docs/review/golden-replay-results.md';
const printOnly = process.argv.includes('--print');

const fail = (msg) => {
  console.error(`review-golden-results: ${msg}`);
  process.exit(2);
};

if (!existsSync(LEDGER)) fail(`${LEDGER} not found`);

const recordText = existsSync(RECORD) ? readFileSync(RECORD, 'utf8') : '';
let records;
try {
  records = parseResultsFile(recordText);
} catch (err) {
  if (err instanceof GoldenResultError) fail(`${RECORD}: ${err.message}`);
  throw err;
}

const expected = renderRunsTable(records);

if (printOnly) {
  console.log(expected);
  process.exit(0);
}

const ledger = readFileSync(LEDGER, 'utf8');
const startIndex = ledger.indexOf(GENERATED_START);
const endIndex = ledger.indexOf(GENERATED_END);
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex)
  fail(
    `${LEDGER} has no ${GENERATED_START} / ${GENERATED_END} marker pair to compare against`,
  );

const actual = ledger
  .slice(startIndex + GENERATED_START.length, endIndex)
  .trim();

if (actual !== expected) {
  console.error(
    `review-golden-results: ${LEDGER}'s generated Runs section does not match ${RECORD}\n`,
  );
  console.error('--- expected (rendered from the record) ---');
  console.error(expected);
  console.error('--- actual (between the markers in the ledger) ---');
  console.error(actual);
  console.error(
    `\nRegenerate with \`node ${process.argv[1] ?? 'tools/scripts/check-review-golden-results.mjs'} --print\` and paste the output between the markers, or fix ${RECORD}.`,
  );
  process.exit(1);
}

console.log(
  `review-golden-results: OK — ${records.length} recorded line(s), ${records.length ? new Set(records.map((r) => r.run_id)).size : 0} run(s), match the ledger's generated Runs section`,
);
