#!/usr/bin/env node
// Asserts that the code review workflow's concurrency group and its `context`
// job's `if:` agree about which triggers are inert.
//
//   node tools/scripts/check-review-concurrency.mjs [--print]
//
// The two are written in the same language about the same event payload, and
// they cannot be shared: `concurrency` is evaluated when the run is created,
// before any job `if:` is read. That gap is the whole reason this check
// exists. A run whose jobs all skip is not a harmless run — it still joins the
// concurrency group, and with `cancel-in-progress` it takes the in-flight
// review with it.
//
// It happened twice. `ai:create-pr` adds labels a second after opening a pull
// request, and those `labeled` runs cancelled the review on #687 and #690. The
// fix sent them to a group of their own, and three weeks of nothing later a
// GitGuardian comment on #693 did exactly the same thing through the
// `issue_comment` trigger, which had been left in the shared group. That one
// was invisible where anyone would look: `issue_comment` runs are attributed
// to the default branch, so they never appear when listing runs for the pull
// request's branch.
//
// So the invariant is: every trigger the `context` job refuses must also be
// steered out of the review's concurrency group. This cannot be checked by
// evaluating the expressions — that would mean implementing GitHub's
// expression language — so it is checked structurally, on the two literals
// that decide it. If someone renames the trigger label or the command, both
// places have to change, and this fails until they do.
//
// Exit 0 = the two agree. Exit 1 = they have drifted. Exit 2 = could not run.
import { readFileSync } from 'node:fs';

const WORKFLOW = '.github/workflows/code-review.yml';
const printOnly = process.argv.includes('--print');

const fail = (msg) => {
  console.error(`review-concurrency: ${msg}`);
  process.exit(2);
};

let source;
try {
  source = readFileSync(WORKFLOW, 'utf8');
} catch (err) {
  fail(`cannot read ${WORKFLOW}: ${err.message}`);
}

/** The `concurrency:` block's `group:` line, expression and all. */
const group = source.match(/^concurrency:\n(?:.*\n)*?\s*group:\s*(.+)$/m)?.[1];
if (!group) fail(`no concurrency group found in ${WORKFLOW}`);

/**
 * The `context` job's `if:`. It is a `>-` block, so take the indented lines
 * that follow until the next key at the same depth.
 */
const contextIf = source
  .match(/^ {2}context:\n(?:.*\n)*?^ {4}if: >-\n((?:^ {6}.*\n)+)/m)?.[1]
  ?.replace(/\s+/g, ' ')
  .trim();
if (!contextIf) fail(`no context job \`if:\` found in ${WORKFLOW}`);

// Each gate is one trigger the context job refuses. `admits` is what the `if:`
// must say to let the deliberate case through; `steers` is what the group must
// say to keep the refused case out of the review's group.
const GATES = [
  {
    what: 'the re-review label',
    admits: /github\.event\.label\.name == '([^']+)'/,
    steers: (name) => `github.event.label.name != '${name}'`,
  },
  {
    what: 'the re-review command',
    admits: /startsWith\(github\.event\.comment\.body, '([^']+)'\)/,
    steers: (cmd) => `!startsWith(github.event.comment.body, '${cmd}')`,
  },
];

const findings = [];
const resolved = [];
for (const gate of GATES) {
  const literal = contextIf.match(gate.admits)?.[1];
  if (!literal) {
    findings.push(
      `the context job's \`if:\` no longer names ${gate.what}; this check cannot tell what the group should steer`,
    );
    continue;
  }
  const needle = gate.steers(literal);
  resolved.push({ what: gate.what, literal, needle });
  if (!group.includes(needle))
    findings.push(
      `${gate.what} is '${literal}' in the context job's \`if:\`, but the concurrency group does not contain \`${needle}\` — a run that skips would still cancel the review`,
    );
}

// The group must actually route somewhere else, not merely mention the guards.
if (!/'-[a-z]+'/.test(group))
  findings.push(
    'the concurrency group has no distinct suffix for inert runs, so every trigger shares one group',
  );

if (printOnly) {
  console.log(`group:  ${group}`);
  console.log(`if:     ${contextIf}`);
  for (const r of resolved)
    console.log(`gate:   ${r.what} = '${r.literal}' -> requires ${r.needle}`);
}

if (findings.length) {
  console.error(
    `review-concurrency: ${findings.length} finding(s) — ${WORKFLOW} can cancel its own review`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `review-concurrency: OK — ${resolved.length} trigger(s) the context job refuses are steered out of the review's concurrency group`,
);
