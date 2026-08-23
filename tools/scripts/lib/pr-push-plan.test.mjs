/**
 * Run with: yarn ai:create-pr:test  (node --test, no jest project covers tools/)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORCE_FLAG,
  PUSH_ACTIONS,
  decidePushPlan,
  parseCherryOutput,
} from './pr-push-plan.mjs';

const BRANCH = 'docs/some-branch';
const REMOTE_SHA = 'de45a82f229528b8607cb60f19c4c09c8b546ae3';

const plan = (overrides) =>
  decidePushPlan({
    hasUpstream: true,
    ahead: 0,
    behind: 0,
    branch: BRANCH,
    ...overrides,
  });

test('publishes a branch that has no upstream yet', () => {
  const result = plan({ hasUpstream: false });
  assert.equal(result.action, PUSH_ACTIONS.setUpstream);
  assert.deepEqual(result.args, ['push', '-u', 'origin', 'HEAD']);
});

test('does nothing when the upstream is already at this commit', () => {
  assert.equal(plan({}).action, PUSH_ACTIONS.upToDate);
});

test('pushes normally when strictly ahead', () => {
  const result = plan({ ahead: 3 });
  assert.equal(result.action, PUSH_ACTIONS.fastForward);
  assert.deepEqual(result.args, ['push', 'origin', 'HEAD']);
});

test('refuses when strictly behind', () => {
  const result = plan({ behind: 2 });
  assert.match(result.error, /behind its upstream/);
  assert.equal(result.action, undefined);
});

test('refuses a diverged branch when the flag is absent, and names the flag', () => {
  const result = plan({ ahead: 2, behind: 1 });
  assert.equal(result.action, undefined);
  assert.match(result.error, /diverged \(2 local, 1 remote\)/);
  assert.ok(
    result.error.includes(FORCE_FLAG),
    'the refusal must tell the caller how to proceed',
  );
});

test('forces a rebased branch with a lease pinned to the observed SHA', () => {
  const result = plan({
    ahead: 2,
    behind: 1,
    remoteSha: REMOTE_SHA,
    forceWithLease: true,
  });
  assert.equal(result.action, PUSH_ACTIONS.forceWithLease);
  assert.deepEqual(result.args, [
    'push',
    `${FORCE_FLAG}=${BRANCH}:${REMOTE_SHA}`,
    'origin',
    'HEAD',
  ]);
});

test('never emits a bare lease, which a background fetch would defeat', () => {
  const result = plan({
    ahead: 1,
    behind: 1,
    remoteSha: REMOTE_SHA,
    forceWithLease: true,
  });
  assert.ok(
    !result.args.includes(FORCE_FLAG),
    'the unpinned flag must never appear on its own',
  );
  assert.ok(result.args.some((a) => a.startsWith(`${FORCE_FLAG}=`)));
});

test('refuses to force when the upstream SHA could not be resolved', () => {
  for (const remoteSha of [undefined, '', '   ']) {
    const result = plan({
      ahead: 1,
      behind: 1,
      remoteSha,
      forceWithLease: true,
    });
    assert.equal(result.action, undefined, `remoteSha=${remoteSha}`);
    assert.match(result.error, /lease cannot be pinned|could not be resolved/);
  }
});

test('refuses to force over upstream commits that exist nowhere locally', () => {
  const result = plan({
    ahead: 2,
    behind: 2,
    remoteSha: REMOTE_SHA,
    forceWithLease: true,
    unmatchedRemoteCommits: ['aaaaaaa', 'bbbbbbb'],
  });
  assert.equal(
    result.action,
    undefined,
    'the flag must not override somebody else’s work',
  );
  assert.match(result.error, /would destroy them/);
  assert.ok(result.error.includes('aaaaaaa'));
  assert.ok(result.error.includes('bbbbbbb'));
});

test('refuses unmatched upstream commits even without the flag', () => {
  const result = plan({
    ahead: 1,
    behind: 1,
    unmatchedRemoteCommits: ['aaaaaaa'],
  });
  assert.match(result.error, /would destroy them/);
});

test('refuses when the commit counts are not numbers', () => {
  assert.match(plan({ ahead: Number.NaN, behind: 0 }).error, /Could not count/);
  assert.match(plan({ ahead: 0, behind: undefined }).error, /Could not count/);
});

test('parses git cherry output into unmatched and equivalent commits', () => {
  const { unmatched, equivalent } = parseCherryOutput(
    [
      '- de45a82f229528b8607cb60f19c4c09c8b546ae3',
      '+ 1111111222222233333334444444555555566666',
      '',
      'not a cherry line',
    ].join('\n'),
  );
  assert.deepEqual(equivalent, ['de45a82f229528b8607cb60f19c4c09c8b546ae3']);
  assert.deepEqual(unmatched, ['1111111222222233333334444444555555566666']);
});

test('parses an empty or absent cherry output as no commits either way', () => {
  for (const input of ['', '   ', undefined, null]) {
    const parsed = parseCherryOutput(input);
    assert.deepEqual(parsed.unmatched, []);
    assert.deepEqual(parsed.equivalent, []);
  }
});

test('a pure rebase — every remote commit superseded — is the forceable case', () => {
  const { unmatched } = parseCherryOutput('- de45a82f229528b8607cb60f19c4c09c');
  const result = plan({
    ahead: 1,
    behind: 1,
    remoteSha: REMOTE_SHA,
    forceWithLease: true,
    unmatchedRemoteCommits: unmatched,
  });
  assert.equal(result.action, PUSH_ACTIONS.forceWithLease);
});
