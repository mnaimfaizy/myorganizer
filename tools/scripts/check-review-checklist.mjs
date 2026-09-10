#!/usr/bin/env node
// Asserts that docs/review/REVIEW_CHECKLIST.md and
// tools/config/review-obligations.json describe the same obligations.
//
//   node tools/scripts/check-review-checklist.mjs [--print]
//
// The checklist is the human form of the catalogue: same questions, same
// answers, different delivery. Prose that must track a source of truth
// elsewhere is the shape this repo already gates everywhere else
// (vault:pages:check, auth:pages:check, review:pages:check,
// deploy:pages:check). Without this checker an obligation's id or its
// answerFields can move in the JSON while the entry a human reads still
// describes the old one, and the file's own claim — one artifact, two
// readers — quietly stops being true.
//
// What is asserted is what is mechanical: the set and order of ids, and
// each entry's answer fields. The rationale, the trigger prose, and the
// incident history are deliberately not asserted; they are writing, and a
// gate over writing is a gate nobody can satisfy.
//
// Exit 0 = sound. Exit 1 = findings. Exit 2 = could not run.
import { readFileSync } from 'node:fs';

import { loadObligationCatalogue } from './review/obligations.mjs';

const CHECKLIST = 'docs/review/REVIEW_CHECKLIST.md';

const die = (msg) => {
  console.error(`review-checklist: ${msg}`);
  process.exit(2);
};

/**
 * Parse the checklist's numbered entries.
 *
 * An entry is a `## <n>. <title>` section carrying an `**id** \`<id>\`` line.
 * Sections without one (the preamble, Deferred candidates, Maintaining this
 * file) are prose about the list rather than entries in it, and are skipped.
 *
 * @param {string} md
 * @returns {{id: string, title: string, answerFields: string[]}[]}
 */
export function parseChecklist(md) {
  const entries = [];
  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const title = section.split('\n', 1)[0].trim();
    const idMatch = section.match(/^\*\*id\*\*\s+`([^`]+)`/m);
    if (!idMatch) continue;
    // The answer table's first column names the fields, one per row, each
    // backticked. The header and its separator carry no backticks, so they
    // fall out without special-casing.
    const answerFields = [];
    for (const line of section.split('\n')) {
      const cell = line.match(/^\|\s*`([^`]+)`\s*\|/);
      if (cell) answerFields.push(cell[1]);
    }
    entries.push({ id: idMatch[1], title, answerFields });
  }
  return entries;
}

let md;
try {
  md = readFileSync(CHECKLIST, 'utf8');
} catch (err) {
  die(`cannot read ${CHECKLIST}: ${err.message}`);
}

let catalogue;
try {
  catalogue = loadObligationCatalogue();
} catch (err) {
  die(err.message);
}

const entries = parseChecklist(md);
const findings = [];

const wanted = catalogue.obligations.map((o) => o.id);
const found = entries.map((e) => e.id);

for (const id of wanted)
  if (!found.includes(id))
    findings.push(`obligation ${id} has no entry in ${CHECKLIST}`);
for (const id of found)
  if (!wanted.includes(id))
    findings.push(`${CHECKLIST} documents ${id}, which the catalogue does not`);

// Order is asserted only once both sides carry the same ids; reporting a
// reorder on top of a missing entry is noise about a problem already named.
if (findings.length === 0 && wanted.join(',') !== found.join(','))
  findings.push(
    `entry order differs: catalogue has ${wanted.join(', ')}; ` +
      `${CHECKLIST} has ${found.join(', ')}`,
  );

for (const o of catalogue.obligations) {
  const entry = entries.find((e) => e.id === o.id);
  if (!entry) continue;
  const a = o.answerFields.join(', ');
  const b = entry.answerFields.join(', ');
  if (a !== b)
    findings.push(
      `${o.id}: answerFields are [${a}] in the catalogue but the entry's ` +
        `answer table lists [${b}]`,
    );
}

if (process.argv.includes('--print')) {
  console.log(`catalogue: ${wanted.join(', ')}`);
  for (const e of entries)
    console.log(`entry ${e.id}: ${e.answerFields.join(', ')}`);
}

if (findings.length) {
  for (const f of findings) console.error(`review-checklist: ${f}`);
  process.exit(1);
}
console.log(
  `review-checklist: ${entries.length} entries match the obligation catalogue`,
);
