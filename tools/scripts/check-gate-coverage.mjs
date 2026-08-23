#!/usr/bin/env node
// Asserts that every checker in tools/scripts/ is a Wired Gate — invoked by
// some hook or workflow — and names the ones that are not (ADR 0043).
//
//   node tools/scripts/check-gate-coverage.mjs
//
// The corollary in ADR 0043 is that a gate that runs nowhere asserts nothing.
// Nine `check-*.mjs` scripts were in exactly that state when #438 was designed:
// they existed, they passed, and no pipeline had ever run them. One of the nine
// had been failing on `main` for days with nobody watching, which is the whole
// argument — a green pipeline says nothing about whether a gate looked at
// anything. This is the gate that gates the gates.
//
// Checkers are found by the `check-*.mjs` filename convention, never by a
// `*:check` script-name suffix: `openapi:artifacts` and `component:hygiene`
// carry no such suffix, and the first is one of the two unwired checks that
// motivated the rule. Wiring is matched by exact script name — a substring
// match on `yarn openapi:artifacts` also matches `openapi:artifacts:test`, and
// reporting an unwired check as wired because its contract suite runs is the
// exact false pass this file exists to prevent.
//
// A checker the pre-commit hook reaches only through `yarn gates:run` counts as
// wired, resolved through that aggregate's manifest and no deeper. The decision
// itself lives in tools/scripts/lib/gate-coverage.mjs; this file is IO.
//
// Deliberate non-gates carry an entry with a written reason in
// tools/config/gate-coverage-optout.json.
//
// Exit 0 = every checker is wired or deliberately opted out. Exit 1 = at least
// one checker runs nowhere. Exit 2 = the check could not run.
import {
  OPT_OUT_PATH,
  assertGateCoverage,
  gatherFromDisk,
} from './lib/gate-coverage.mjs';

const report = assertGateCoverage(gatherFromDisk());

// The verdict and its exit code both come from the report; this file chooses
// what to print, never what the answer is.
if (report.errors.length) {
  console.error('gate-coverage: the check could not run\n');
  for (const error of report.errors) console.error(`  - ${error}`);
  process.exit(report.exitCode);
}

if (report.unwired.length) {
  console.error(
    'gate-coverage: checker is invoked by no hook and no workflow (ADR 0043)\n',
  );
  for (const { checker, npmScripts } of report.unwired) {
    const invocation = npmScripts.length
      ? npmScripts.map((name) => `yarn ${name}`).join(' / ')
      : `node ${checker}`;
    console.error(`  ${checker}`);
    console.error(`    runnable as: ${invocation}`);
  }
  const aggregateScript = report.aggregate.npmScripts[0] ?? 'gates:run';
  console.error(
    '\nA gate that runs nowhere asserts nothing. Wire each one by its exact' +
      '\nscript name into .husky/pre-commit or a workflow, or declare it in the' +
      '\naggregate manifest (tools/scripts/lib/gate-manifest.mjs) so' +
      `\n\`yarn ${aggregateScript}\` runs it. If it is deliberately not a gate, add` +
      `\nan entry to ${OPT_OUT_PATH} with a written reason.`,
  );
  if (!report.aggregate.wired) {
    console.error(
      `\nNote: ${report.aggregate.script} is itself invoked by no pipeline, so` +
        '\nnothing its manifest names counts as wired.',
    );
  }
  process.exit(report.exitCode);
}

const throughAggregate = report.wired.filter((entry) =>
  entry.via.some((via) => via.kind === 'aggregate'),
).length;

console.log(
  `gate-coverage: ${report.wired.length} checkers wired ` +
    `(${throughAggregate} reached through \`yarn ${
      report.aggregate.npmScripts[0] ?? 'gates:run'
    }\`), ` +
    `${report.optedOut.length} checkers opted out, ` +
    `${report.declaredNonGates.length} non-gates declared with a reason`,
);
