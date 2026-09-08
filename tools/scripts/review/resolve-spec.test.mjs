import assert from 'node:assert/strict';
import test from 'node:test';

import { discoverSpec } from './resolve-spec.mjs';

test('the branch name wins when it carries an issue number', () => {
  assert.deepEqual(
    discoverSpec({
      headRef: 'fix/292-graphify-extraction-gaps',
      commits: ['fix: closes #999'],
    }),
    { kind: 'issue', ref: '#292', foundBy: 'branch' },
  );
});

test('a branch without a number falls back to the first commit reference', () => {
  assert.deepEqual(
    discoverSpec({
      headRef: 'feat/review-tier-classifier',
      commits: ['feat(review): classifier', 'Refs #123 and closes #456'],
    }),
    { kind: 'issue', ref: '#123', foundBy: 'commits' },
  );
});

test('a bare number is a PR number or a citation, not an issue reference', () => {
  assert.deepEqual(
    discoverSpec({
      headRef: 'chore/tidy',
      commits: [
        'bump to v1.2.3',
        'ADR 0070 item #4 reads',
        'feat: squash merge (#123)',
        'the first run on #678 failed',
      ],
    }),
    { kind: 'none', foundBy: 'none' },
  );
  assert.deepEqual(
    discoverSpec({ headRef: 'release/v1.2.3', commits: ['sha abc#12'] }),
    { kind: 'none', foundBy: 'none' },
  );
});

test('a keyword reference in a commit body is found, case-insensitively', () => {
  for (const line of ['Closes #12', 'fixes #12', 'Refs #12', 'see #12']) {
    assert.deepEqual(
      discoverSpec({ headRef: 'chore/tidy', commits: ['subject', line] }),
      { kind: 'issue', ref: '#12', foundBy: 'commits' },
      line,
    );
  }
});

test('nothing found is a none spec with no ref', () => {
  assert.deepEqual(discoverSpec({ headRef: undefined, commits: [] }), {
    kind: 'none',
    foundBy: 'none',
  });
});
