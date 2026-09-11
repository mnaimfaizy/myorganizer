import assert from 'node:assert/strict';
import test from 'node:test';

import { discoverSpec } from '../review/resolve-spec.mjs';
import {
  branchNameCarriesIssue,
  specAnchorMessage,
} from './sandcastle-spec-anchor.mjs';

// The anchor is only worth anything if the real resolver reads it, so the
// assertion runs the real resolver rather than re-stating its regex.
test('the anchor message resolves to its issue through the commit step', () => {
  const message = specAnchorMessage({
    branch: 'feat/code-review-trust',
    issue: 713,
    title: 'Code review trust',
  });
  assert.deepEqual(
    discoverSpec({ headRef: 'feat/code-review-trust', commits: [message] }),
    { kind: 'issue', ref: '#713', foundBy: 'commits' },
  );
});

test('the anchor loses to a branch name that already carries an issue', () => {
  const message = specAnchorMessage({ branch: 'slice/720-x', issue: 713 });
  assert.deepEqual(
    discoverSpec({ headRef: 'slice/720-x', commits: [message] }),
    { kind: 'issue', ref: '#720', foundBy: 'branch' },
  );
});

test('the anchor is the oldest commit, so it wins over later slice references', () => {
  const anchor = specAnchorMessage({ branch: 'feat/trust', issue: 713 });
  assert.deepEqual(
    discoverSpec({
      headRef: 'feat/trust',
      commits: [anchor, 'feat(review): a slice\n\nCloses #720'],
    }),
    { kind: 'issue', ref: '#713', foundBy: 'commits' },
  );
});

test('the subject names the branch and the issue', () => {
  const [subject] = specAnchorMessage({
    branch: 'feat/trust',
    issue: 713,
  }).split('\n');
  assert.equal(subject, 'chore(sandcastle): anchor feat/trust to #713');
});

test('the title is optional and omitted cleanly', () => {
  const message = specAnchorMessage({ branch: 'feat/trust', issue: 713 });
  assert.ok(!message.includes('Issue:'));
  assert.ok(message.endsWith('Closes #713'));
});

test('a missing or nonsense issue number is refused, not silently anchored', () => {
  for (const issue of [undefined, 0, -1, 1.5, '713']) {
    assert.throws(
      () => specAnchorMessage({ branch: 'feat/trust', issue }),
      /positive issue number/,
      String(issue),
    );
  }
  assert.throws(
    () => specAnchorMessage({ branch: '', issue: 713 }),
    /branch name/,
  );
});

test('branchNameCarriesIssue agrees with the resolver about every prefix', () => {
  const cases = [
    'slice/720-code-review-trust',
    'fix/292-graphify-extraction-gaps',
    'feat/code-review-trust-harness',
    'claude/add-spec-anchor',
    'copilot/fix-thing',
    'release/v1.2.3',
  ];
  for (const branch of cases) {
    assert.equal(
      branchNameCarriesIssue(branch),
      discoverSpec({ headRef: branch, commits: [] }).foundBy === 'branch',
      branch,
    );
  }
});
