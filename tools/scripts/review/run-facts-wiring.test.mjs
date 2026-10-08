// Asserts that every CI validation of the reviewer's report is handed the
// run facts file (issue #1031, ADR 0123).
//
// The validator overwrites the report's own claims about its run only when it
// is given `--facts`. A validation without it writes a normalized report
// marked self-reported, carrying whatever the reviewer wrote. The first
// version of this change added `--facts` to the action's validation and
// missed the workflow step that validates the report a second time to carry
// finding ids forward, which then moved its output over the first: every
// review after the first on a branch would have published the reviewer's
// claims. Nothing failed, because each validation is correct on its own.
//
// Direction: workflows → `--facts`, one way. A validation the reviewer runs
// inside its own session is not matched: it has no transcript to read yet,
// and the action validates again after it exits.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const WORKFLOW_FILES = [
  '.github/actions/code-reviewer/action.yml',
  ...readdirSync('.github/workflows')
    .filter((name) => name.endsWith('.yml'))
    .map((name) => join('.github/workflows', name)),
];

/** A shell step invoking the validator on the report the reviewer wrote. */
const VALIDATION =
  /(?:node "\$VALIDATOR"|corepack yarn review:validate) tmp\/code-review\/report\.json/;

/** Each validation as one command: its line and every continuation of it. */
export const validationsIn = (text) => {
  const lines = text.split('\n');
  const commands = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!VALIDATION.test(lines[i])) continue;
    let command = lines[i];
    let end = i;
    while (lines[end].trimEnd().endsWith('\\') && end + 1 < lines.length) {
      end += 1;
      command += `\n${lines[end]}`;
    }
    commands.push({ line: i + 1, command });
  }
  return commands;
};

test('the scan finds a validation and reads its continuation lines', () => {
  const found = validationsIn(
    [
      'run: |',
      '  if corepack yarn review:validate tmp/code-review/report.json \\',
      "    --tier 'review:human' \\",
      '    --out x.json; then',
      '  fi',
    ].join('\n'),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].line, 2);
  assert.match(found[0].command, /--out x\.json/);
  // A sentence that mentions the validator is not an invocation of it.
  assert.deepEqual(validationsIn('# run review:validate on the report'), []);
});

test('every CI validation of the report passes --facts', () => {
  const all = WORKFLOW_FILES.flatMap((file) =>
    validationsIn(readFileSync(file, 'utf8')).map((v) => ({ file, ...v })),
  );
  // The action validates twice (with and without a tier) and the workflow
  // once more to carry ids. Fewer means the scan stopped matching, and a
  // scan that matches nothing passes everything.
  assert.ok(
    all.length >= 3,
    `expected at least 3 validations of the report across the workflows, found ${all.length}`,
  );
  for (const { file, line, command } of all)
    assert.match(
      command,
      /--facts /,
      `${file}:${line} validates the report without --facts, so its output carries the reviewer's own claims about its run`,
    );
});
