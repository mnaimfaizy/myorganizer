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
      commits: ['feat(review): classifier', 'Refs #123 and #456'],
    }),
    { kind: 'issue', ref: '#123', foundBy: 'commits' },
  );
});

test('a bare number that is not an issue reference is not a spec', () => {
  assert.deepEqual(
    discoverSpec({
      headRef: 'chore/tidy',
      commits: ['bump to v1.2.3', 'ADR 0069 item #4 reads'],
    }),
    // "#4" preceded by a space is a reference; the test pins that reading.
    { kind: 'issue', ref: '#4', foundBy: 'commits' },
  );
  assert.deepEqual(
    discoverSpec({ headRef: 'release/v1.2.3', commits: ['sha abc#12'] }),
    { kind: 'none', foundBy: 'none' },
  );
});

test('nothing found is a none spec with no ref', () => {
  assert.deepEqual(discoverSpec({ headRef: undefined, commits: [] }), {
    kind: 'none',
    foundBy: 'none',
  });
});
