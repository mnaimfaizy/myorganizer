import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blockedBy,
  blocks,
  describeAssembly,
  isCompleted,
  selectPrdSlices,
  slicesOfPrd,
} from './sandcastle-slice-selection.mjs';

const PRD = 461;

const slice = (
  number,
  { labels = [], state = 'OPEN', body = '', prd = PRD } = {},
) => ({
  number,
  state,
  labels: labels.map((name) => ({ name })),
  body: `PRD: #${prd}\n\n${body}`,
});

const READY = ['ready-for-agent', 'type:afk'];
const blockedBySection = (...refs) =>
  `## Blocked by\n\n${refs.length ? refs.map((r) => `- #${r}`).join('\n') : '- None'}\n`;

// ─── The regression this module exists for ────────────────────────────────────

test('a PRD whose later slices are blocked on its first slice selects all of them', () => {
  const issues = [
    slice(463, { labels: READY, body: blockedBySection() }),
    slice(464, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(463),
    }),
    slice(465, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(464),
    }),
  ];

  const { selected, admitted, deferred } = selectPrdSlices(issues, {
    prd: PRD,
  });

  assert.deepEqual(
    selected.map((i) => i.number),
    [463, 464, 465],
    'the run must consider slices it is about to unblock itself',
  );
  assert.deepEqual(
    admitted.map((i) => i.number),
    [464, 465],
  );
  assert.deepEqual(deferred, []);
});

test('a slice already dispatched in a previous run is not selected again', () => {
  const issues = [
    slice(463, { labels: [...READY, 'status:done'], state: 'CLOSED' }),
    slice(464, { labels: READY, body: blockedBySection(463) }),
  ];

  const { selected } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(
    selected.map((i) => i.number),
    [464],
  );
});

// ─── status:blocked that this run cannot evaluate ─────────────────────────────

test('status:blocked with no `## Blocked by` section is deferred, not admitted', () => {
  const issues = [slice(470, { labels: [...READY, 'status:blocked'] })];

  const { selected, deferred } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(selected, []);
  assert.equal(deferred.length, 1);
  assert.equal(deferred[0].issue.number, 470);
  assert.match(deferred[0].reason, /no in-PRD blocker/);
});

test('status:blocked on an issue outside this PRD is deferred', () => {
  const issues = [
    slice(470, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(999),
    }),
  ];

  const { selected, deferred } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(selected, []);
  assert.deepEqual(
    deferred.map((d) => d.issue.number),
    [470],
  );
});

test('a slice blocked on an in-PRD slice AND an external issue is still admitted', () => {
  // Ordering, not selection, decides whether it can actually run: the external
  // blocker never enters completedIssueNumbers, so the loop reports it blocked.
  const issues = [
    slice(463, { labels: READY, body: blockedBySection() }),
    slice(464, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(463, 999),
    }),
  ];

  const { selected, admitted } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(
    selected.map((i) => i.number),
    [463, 464],
  );
  assert.deepEqual(
    admitted.map((i) => i.number),
    [464],
  );
});

test('a slice naming only itself as a blocker is deferred, not self-admitted', () => {
  const issues = [
    slice(470, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(470),
    }),
  ];

  const { selected, deferred } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(selected, []);
  assert.equal(deferred.length, 1);
});

// ─── The label gate is otherwise unchanged ────────────────────────────────────

test('an issue missing ready-for-agent or type:afk is not selected', () => {
  const issues = [
    slice(470, { labels: ['type:afk'] }),
    slice(471, { labels: ['ready-for-agent'] }),
    slice(472, { labels: READY }),
  ];

  const { selected } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(
    selected.map((i) => i.number),
    [472],
  );
});

test('an issue belonging to a different PRD is not selected', () => {
  const issues = [
    slice(470, { labels: READY, prd: 999 }),
    slice(471, { labels: READY }),
  ];

  const { selected } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(
    selected.map((i) => i.number),
    [471],
  );
});

test('selection is ordered by issue number regardless of input order', () => {
  const issues = [
    slice(465, { labels: READY }),
    slice(463, { labels: READY }),
    slice(464, { labels: READY }),
  ];

  const { selected } = selectPrdSlices(issues, { prd: PRD });

  assert.deepEqual(
    selected.map((i) => i.number),
    [463, 464, 465],
  );
});

// ─── `only` narrows, never widens ─────────────────────────────────────────────

test('only restricts the run to the named slice', () => {
  const issues = [slice(463, { labels: READY }), slice(464, { labels: READY })];

  const { selected } = selectPrdSlices(issues, { prd: PRD, only: 464 });

  assert.deepEqual(
    selected.map((i) => i.number),
    [464],
  );
});

test('only does not override a deferral — naming a slice cannot widen the rule', () => {
  const issues = [
    slice(470, {
      labels: [...READY, 'status:blocked'],
      body: blockedBySection(999),
    }),
  ];

  const { selected, deferred } = selectPrdSlices(issues, {
    prd: PRD,
    only: 470,
  });

  assert.deepEqual(selected, []);
  assert.equal(deferred.length, 1);
});

// ─── Body parsing ─────────────────────────────────────────────────────────────

test('blockedBy reads `- None` as an explicit empty list', () => {
  assert.deepEqual(blockedBy({ body: '## Blocked by\n\n- None\n' }), []);
});

test('blockedBy stops at the next section heading', () => {
  const body = '## Blocked by\n\n- #463\n\n## Blocks\n\n- #465\n';
  assert.deepEqual(blockedBy({ body }), [463]);
  assert.deepEqual(blocks({ body }), [465]);
});

test('blockedBy on an issue with no such section is empty', () => {
  assert.deepEqual(blockedBy({ body: '## What to build\n\nthings\n' }), []);
});

test('isCompleted accepts either a closed state or status:done', () => {
  assert.equal(isCompleted({ state: 'CLOSED', labels: [] }), true);
  assert.equal(
    isCompleted({ state: 'OPEN', labels: [{ name: 'status:done' }] }),
    true,
  );
  assert.equal(isCompleted({ state: 'OPEN', labels: [] }), false);
});

test('slicesOfPrd matches the PRD back-reference, not a bare number', () => {
  const issues = [
    { number: 1, body: 'PRD: #461' },
    { number: 2, body: 'mentions 461 in prose' },
    { number: 3, body: undefined },
  ];
  assert.deepEqual(
    slicesOfPrd(issues, 461).map((i) => i.number),
    [1],
  );
});

// ─── Assembly reporting ───────────────────────────────────────────────────────

test('describeAssembly reports partial assembly rather than claiming completion', () => {
  const issues = [
    slice(463, { labels: ['status:done'], state: 'CLOSED' }),
    slice(464, { labels: READY }),
    slice(465, { labels: READY }),
  ];

  const assembly = describeAssembly(issues, PRD);

  assert.equal(assembly.total, 3);
  assert.equal(assembly.done, 1);
  assert.equal(assembly.complete, false);
  assert.equal(assembly.summary, '1/3 slice(s) assembled');
});

test('describeAssembly reports completion only when every slice is done', () => {
  const issues = [
    slice(463, { state: 'CLOSED' }),
    slice(464, { labels: ['status:done'] }),
  ];

  const assembly = describeAssembly(issues, PRD);

  assert.equal(assembly.complete, true);
  assert.equal(assembly.summary, '2/2 slice(s) assembled');
});

test('describeAssembly does not claim completion for a PRD with no slices', () => {
  const assembly = describeAssembly([], PRD);
  assert.equal(assembly.complete, false);
  assert.equal(assembly.summary, 'no slices found');
});
