// Covers the checklist/catalogue drift checker's parser. The comparison it
// feeds is three set operations; the parser is where a change to the
// checklist's Markdown shape would silently stop the gate from seeing
// anything, which is the failure that matters — a checker that parses
// nothing passes everything.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  citedFieldLabel,
  guardedEnumCoverage,
  parseChecklist,
} from './check-review-checklist.mjs';
import { GUARDED_ENUMS } from './lib/guarded-enums.mjs';
import { loadObligationCatalogue } from './review/obligations.mjs';

const ENTRY = `## 1. Do the thing

**id** \`do-the-thing\`
**Fires when** something happens.

**Answer**

| Field   | What to write |
| ------- | ------------- |
| \`alpha\` | The alpha.    |
| \`beta\`  | The beta.     |

**Cites** \`alpha\`

**Defect** — alpha is missing.
`;

test('an entry yields its id and its answer fields in order', () => {
  const [entry] = parseChecklist(ENTRY);
  assert.equal(entry.id, 'do-the-thing');
  assert.deepEqual(entry.answerFields, ['alpha', 'beta']);
});

test('a section without an id line is prose about the list, not an entry', () => {
  const md = `## Deferred candidates

Real, incident-backed, and deliberately not in the first cohort.

- **Something held back.** With \`code\` in it.

${ENTRY}`;
  assert.deepEqual(
    parseChecklist(md).map((e) => e.id),
    ['do-the-thing'],
  );
});

test('the table header and separator are not mistaken for fields', () => {
  // They carry no backticks, which is the whole reason the row pattern
  // requires them rather than counting pipes.
  const [entry] = parseChecklist(ENTRY);
  assert.ok(!entry.answerFields.includes('Field'));
  assert.equal(entry.answerFields.length, 2);
});

test('entries come back in document order, which is what the gate compares', () => {
  const second = ENTRY.replace('do-the-thing', 'do-the-other-thing').replace(
    '## 1.',
    '## 2.',
  );
  assert.deepEqual(
    parseChecklist(`${ENTRY}\n${second}`).map((e) => e.id),
    ['do-the-thing', 'do-the-other-thing'],
  );
});

test('a backticked word in prose outside a table row is not an answer field', () => {
  // Only a line that *starts* a table row counts. An inline `field` in a
  // sentence would otherwise be read as one, and the gate would report
  // drift on an entry nobody changed.
  const md = ENTRY.replace(
    '**Defect** — alpha is missing.',
    '**Defect** — `alpha` is missing.',
  );
  assert.deepEqual(parseChecklist(md)[0].answerFields, ['alpha', 'beta']);
});

test('the Cites line names the fields whose answers must quote a line', () => {
  const [entry] = parseChecklist(ENTRY);
  assert.deepEqual(entry.citedFields, [{ field: 'alpha' }]);
});

test('a cited field may name the one value that has no line to quote', () => {
  // `wiredBy: none` says nothing invokes the gate. The catalogue spells that
  // `uncitedWhen`; the entry a human reads spells it `unless`, and the gate
  // compares the two, so the parser has to see it.
  const md = ENTRY.replace(
    '**Cites** `alpha`',
    '**Cites** `alpha` unless `none`, `beta`',
  );
  assert.deepEqual(parseChecklist(md)[0].citedFields, [
    { field: 'alpha', uncitedWhen: 'none' },
    { field: 'beta' },
  ]);
  assert.deepEqual(parseChecklist(md)[0].citedFields.map(citedFieldLabel), [
    'alpha unless none',
    'beta',
  ]);
});

test('an entry with no Cites line cites nothing, and says so', () => {
  // Not "cites everything" and not a crash: the comparison downstream is
  // between two lists, and an absent line is an empty one.
  const md = ENTRY.replace('**Cites** `alpha`\n\n', '');
  assert.deepEqual(parseChecklist(md)[0].citedFields, []);
});

// --- The guarded-enum obligation is held to the fan-out gate's list ----------
//
// The list lives in tools/scripts/lib/guarded-enums.mjs and the obligation's
// trigger restates it as globs, so the two drift the way any restatement does.
// Each direction below is one the checker's header claims to catch.

const GUARD = {
  enum: 'Colour',
  definedIn: 'libs/api/src/api.ts',
  valueRoots: ['libs/paint/src/', 'libs/ink/src/'],
};

const enumCatalogue = (paths) => ({
  obligations: [
    { id: 'not-about-enums', trigger: { paths: ['libs/**'] } },
    {
      id: 'enum-entry',
      siteFields: ['guardedEnum', 'coveringGate'],
      trigger: { paths },
    },
  ],
});

const path = (glob, guardedEnum = 'Colour') => ({
  glob,
  guardedEnum,
  coveringGate: 'enum:fanout:check',
});

const FULL = [
  path('libs/api/src/api.ts'),
  path('libs/paint/src/**'),
  path('libs/ink/src/**'),
];

test('a trigger covering the declaration file and every value root agrees', () => {
  assert.deepEqual(guardedEnumCoverage(enumCatalogue(FULL), [GUARD]), []);
});

test('a guarded enum whose declaration file no trigger path matches fails', () => {
  const findings = guardedEnumCoverage(enumCatalogue(FULL.slice(1)), [GUARD]);
  assert.equal(findings.length, 1);
  assert.match(
    findings[0],
    /Colour: .*declaration file libs\/api\/src\/api\.ts/,
  );
});

test('a value root no trigger path matches fails, even when a sibling is covered', () => {
  const findings = guardedEnumCoverage(
    enumCatalogue(FULL.filter((p) => !p.glob.startsWith('libs/ink'))),
    [GUARD],
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /value root libs\/ink\/src\//);
});

test('a path covering the file under another enum name does not count for this one', () => {
  const findings = guardedEnumCoverage(
    enumCatalogue([path('libs/api/src/api.ts', 'Shade'), ...FULL.slice(1)]),
    [GUARD],
  );
  // Twice over: Colour's declaration file is uncovered, and Shade is guarded
  // by nothing.
  assert.equal(findings.length, 2);
  assert.ok(findings.some((f) => /Shade, which .* does not guard/.test(f)));
});

test('no obligation asking about guarded enums fails while any enum is guarded', () => {
  const none = { obligations: [{ id: 'x', trigger: { paths: ['libs/**'] } }] };
  assert.match(guardedEnumCoverage(none, [GUARD])[0], /never the reviewer/);
  assert.deepEqual(guardedEnumCoverage(none, []), []);
});

test('the live catalogue covers the live guarded-enum list', () => {
  assert.deepEqual(
    guardedEnumCoverage(loadObligationCatalogue(), GUARDED_ENUMS),
    [],
  );
});
