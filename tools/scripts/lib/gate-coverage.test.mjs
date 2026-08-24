import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OPT_OUT_SCHEMA_VERSION,
  assertGateCoverage,
  gatherFromDisk,
  listCheckers,
  nodeRuns,
  pipelineInvocations,
  stripComments,
} from './gate-coverage.mjs';

const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const AGGREGATE = 'tools/scripts/run-assertion-gates.mjs';

/** A wired aggregate: the hook invokes `gates:run`, which runs the runner. */
const aggregateOf = (manifest) => ({ script: AGGREGATE, manifest });

const hook = (text) => [{ path: '.husky/pre-commit', text }];

const optOutList = (entries) =>
  JSON.stringify({ schemaVersion: OPT_OUT_SCHEMA_VERSION, optOut: entries });

test('pipelineInvocations matches a script name exactly, never as a substring', () => {
  const { names } = pipelineInvocations(
    'corepack yarn openapi:artifacts:test\n',
  );

  assert.ok(names.has('openapi:artifacts:test'));
  assert.ok(!names.has('openapi:artifacts'));
});

test('stripComments drops a gate command that only appears in prose', () => {
  const stripped = stripComments(
    '# These also run through `corepack yarn gates:run` in the hook\ncorepack yarn readme:check\n',
  );

  assert.ok(!stripped.includes('gates:run'));
  assert.ok(stripped.includes('readme:check'));
});

test('nodeRuns marks a --test invocation as a test runner, not a checker run', () => {
  assert.deepEqual(nodeRuns('node --test tools/scripts/check-a.test.mjs'), [
    { script: 'tools/scripts/check-a.test.mjs', isTestRunner: true },
  ]);
  assert.deepEqual(nodeRuns('node tools/scripts/check-a.mjs --staged'), [
    { script: 'tools/scripts/check-a.mjs', isTestRunner: false },
  ]);
});

test('listCheckers finds check-*.mjs by filename and excludes contract suites', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'gate-coverage-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(join(workspace, 'tools/scripts'), { recursive: true });
  for (const name of [
    'check-a.mjs',
    'check-a.test.mjs',
    'sync-b.mjs',
    'run-assertion-gates.mjs',
  ]) {
    writeFileSync(join(workspace, 'tools/scripts', name), '');
  }

  assert.deepEqual(listCheckers({ cwd: workspace }), [
    'tools/scripts/check-a.mjs',
  ]);
});

// Contract case 1 — the defect the gate exists for.
test('an unwired checker is caught and named', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs', 'tools/scripts/check-b.mjs'],
    pkgScripts: {
      'a:check': 'node tools/scripts/check-a.mjs',
      'b:check': 'node tools/scripts/check-b.mjs',
    },
    pipelines: hook('corepack yarn a:check\n'),
    optOut: optOutList([]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 1);
  assert.deepEqual(
    report.unwired.map((entry) => entry.checker),
    ['tools/scripts/check-b.mjs'],
  );
  assert.deepEqual(report.unwired[0].npmScripts, ['b:check']);
});

// Contract case 2 — the weak joint. Without this, wiring the aggregate would
// report every checker it runs as unwired, on the very change that wires them.
test('a checker reached only through the aggregate manifest counts as wired', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: {
      'a:check': 'node tools/scripts/check-a.mjs',
      'gates:run': `node ${AGGREGATE}`,
    },
    pipelines: hook('corepack yarn gates:run\n'),
    optOut: optOutList([]),
    aggregate: aggregateOf([
      {
        id: 'a:check',
        npmScript: 'a:check',
        script: 'tools/scripts/check-a.mjs',
        args: [],
      },
    ]),
  });

  assert.equal(report.exitCode, 0);
  assert.deepEqual(
    report.wired.map((entry) => entry.via.map((via) => via.kind)),
    [['aggregate']],
  );
});

test('the aggregate cannot launder a checker while nothing invokes the aggregate', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: {
      'a:check': 'node tools/scripts/check-a.mjs',
      'gates:run': `node ${AGGREGATE}`,
    },
    pipelines: hook('corepack yarn lint\n'),
    optOut: optOutList([]),
    aggregate: aggregateOf([
      {
        id: 'a:check',
        npmScript: 'a:check',
        script: 'tools/scripts/check-a.mjs',
        args: [],
      },
    ]),
  });

  assert.equal(report.exitCode, 1);
  assert.equal(report.aggregate.wired, false);
  assert.deepEqual(
    report.unwired.map((entry) => entry.checker),
    ['tools/scripts/check-a.mjs'],
  );
});

// Contract case 3 — the false pass reproduced while writing the rule.
test('a contract-test script does not satisfy its sibling checker wiring', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-openapi-artifacts.mjs'],
    pkgScripts: {
      'openapi:artifacts': 'node tools/scripts/check-openapi-artifacts.mjs',
      'openapi:artifacts:test':
        'node --test tools/scripts/check-openapi-artifacts.test.mjs',
    },
    pipelines: [
      {
        path: '.github/workflows/ci.yml',
        text: '      - name: OpenAPI artifact checker contracts\n        run: corepack yarn openapi:artifacts:test\n',
      },
    ],
    optOut: optOutList([]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 1);
  assert.deepEqual(
    report.unwired.map((entry) => entry.checker),
    ['tools/scripts/check-openapi-artifacts.mjs'],
  );
});

// Contract case 4 — an exemption is a decision somebody made.
test('an opt-out with a written reason is honoured', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: { 'a:check': 'node tools/scripts/check-a.mjs' },
    pipelines: hook('corepack yarn lint\n'),
    optOut: optOutList([
      {
        check: 'check-a.mjs',
        reason: 'Superseded by the formatting write step.',
      },
    ]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 0);
  assert.deepEqual(
    report.optedOut.map((entry) => entry.checker),
    ['tools/scripts/check-a.mjs'],
  );
});

test('an opt-out without a reason is rejected, not silently honoured', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: { 'a:check': 'node tools/scripts/check-a.mjs' },
    pipelines: hook('corepack yarn lint\n'),
    optOut: optOutList([
      { check: 'check-a.mjs' },
      { check: 'check-a.mjs', reason: '   ' },
    ]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 2);
  assert.equal(report.errors.length, 2);
  assert.match(report.errors.join('\n'), /carries no written reason/);
  assert.equal(report.optedOut.length, 0);
});

test('an opt-out may name the npm script of a checker, or a non-gate script', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: {
      'a:check': 'node tools/scripts/check-a.mjs',
      'format:check': 'nx format:check',
    },
    pipelines: hook('corepack yarn lint\n'),
    optOut: optOutList([
      { check: 'a:check', reason: 'Runs on a monthly schedule instead.' },
      {
        check: 'format:check',
        reason: 'Superseded by the hook formatting write step.',
      },
    ]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 0);
  assert.deepEqual(
    report.optedOut.map((entry) => entry.checker),
    ['tools/scripts/check-a.mjs'],
  );
  assert.deepEqual(
    report.declaredNonGates.map((entry) => entry.check),
    ['format:check'],
  );
});

test('an opt-out for a checker that is wired is rejected as a contradiction', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: { 'a:check': 'node tools/scripts/check-a.mjs' },
    pipelines: hook('corepack yarn a:check\n'),
    optOut: optOutList([
      { check: 'check-a.mjs', reason: 'We decided it is not a gate.' },
    ]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 2);
  assert.match(
    report.errors.join('\n'),
    /must not disagree with the pipelines/,
  );
});

test('an opt-out list carrying an unknown schemaVersion is rejected', () => {
  const report = assertGateCoverage({
    checkers: [],
    pipelines: [],
    optOut: JSON.stringify({ schemaVersion: 99, optOut: [] }),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 2);
  assert.match(report.errors.join('\n'), /expected "schemaVersion": 1/);
});

test('an opt-out naming something that no longer exists is rejected', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: { 'a:check': 'node tools/scripts/check-a.mjs' },
    pipelines: hook('corepack yarn a:check\n'),
    optOut: optOutList([
      { check: 'check-deleted.mjs', reason: 'It went away.' },
    ]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 2);
  assert.match(
    report.errors.join('\n'),
    /check-deleted\.mjs` is neither a checker/,
  );
});

test('a missing opt-out list is an error, not an empty exemption set', () => {
  const report = assertGateCoverage({
    checkers: [],
    pipelines: [],
    optOut: null,
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 2);
  assert.match(report.errors.join('\n'), /not found/);
});

// Indirection resolves exactly one level.
test('a nested aggregate is an error, not a recursion', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: {
      'gates:run': `node ${AGGREGATE}`,
      'inner:run': 'node tools/scripts/run-inner-gates.mjs',
    },
    pipelines: hook('corepack yarn gates:run\n'),
    optOut: optOutList([]),
    aggregate: aggregateOf([
      {
        id: 'inner',
        npmScript: 'inner:run',
        script: 'tools/scripts/run-inner-gates.mjs',
        args: [],
      },
    ]),
    readSource: (path) =>
      path === 'tools/scripts/run-inner-gates.mjs'
        ? "import { runGateManifest } from './lib/gate-manifest.mjs';\nrunGateManifest(INNER);\n"
        : null,
  });

  assert.equal(report.exitCode, 2);
  assert.match(
    report.errors.join('\n'),
    /nested aggregate is an error, not a recursion/,
  );
});

test('an aggregate listing itself is an error', () => {
  const report = assertGateCoverage({
    checkers: [],
    pkgScripts: { 'gates:run': `node ${AGGREGATE}` },
    pipelines: hook('corepack yarn gates:run\n'),
    optOut: optOutList([]),
    aggregate: aggregateOf([
      { id: 'self', npmScript: 'gates:run', script: AGGREGATE, args: [] },
    ]),
  });

  assert.equal(report.exitCode, 2);
  assert.match(report.errors.join('\n'), /lists itself in its own manifest/);
});

// `adr:numbering:check` is reached both ways: through the aggregate in the
// hook and as its own CI step. That must be one wired checker, not two
// findings that disagree.
test('a checker wired directly and through the aggregate counts once', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-adr-numbering.mjs'],
    pkgScripts: {
      'adr:numbering:check': 'node tools/scripts/check-adr-numbering.mjs',
      'gates:run': `node ${AGGREGATE}`,
    },
    pipelines: [
      { path: '.husky/pre-commit', text: 'corepack yarn gates:run\n' },
      {
        path: '.github/workflows/ci.yml',
        text: '        run: corepack yarn adr:numbering:check\n',
      },
    ],
    optOut: optOutList([]),
    aggregate: aggregateOf([
      {
        id: 'adr:numbering:check',
        npmScript: 'adr:numbering:check',
        script: 'tools/scripts/check-adr-numbering.mjs',
        args: [],
      },
    ]),
  });

  assert.equal(report.exitCode, 0);
  assert.equal(report.wired.length, 1);
  assert.equal(report.unwired.length, 0);
  assert.deepEqual(
    report.wired[0].via.map((via) => via.kind),
    ['pipeline', 'aggregate'],
  );
});

test('a checker invoked directly by path in a workflow counts as wired', () => {
  const report = assertGateCoverage({
    checkers: ['tools/scripts/check-a.mjs'],
    pkgScripts: {},
    pipelines: [
      {
        path: '.github/workflows/ci.yml',
        text: '        run: node tools/scripts/check-a.mjs --report out.md\n',
      },
    ],
    optOut: optOutList([]),
    aggregate: aggregateOf([]),
  });

  assert.equal(report.exitCode, 0);
  assert.deepEqual(
    report.wired.map((entry) => entry.via[0].kind),
    ['direct'],
  );
});

test('every checker in this repository is wired or opted out with a reason', () => {
  const report = assertGateCoverage(gatherFromDisk({ cwd: REPO_ROOT }));

  assert.deepEqual(report.errors, []);
  assert.deepEqual(
    report.unwired.map((entry) => entry.checker),
    [],
  );
  // A floor, deliberately not an exact count: the issue forbids freezing an
  // inventory anywhere, and deleting a checker is not the defect this gate
  // exists to catch. What the floor guards is the enumeration itself — a path
  // bug that found nothing would otherwise pass as "no unwired checkers".
  assert.ok(
    report.wired.length >= 10,
    `expected the repository to carry at least ten checkers, found ${report.wired.length}`,
  );
});
