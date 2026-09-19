// Structural contracts for the Review Tier wiring that #790 actually failed
// on: the label step must not be able to fail the required check, and an
// empty classifier output must not reach `--tier` or Publish Review.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const REVIEW_TIER = readFileSync('.github/workflows/review-tier.yml', 'utf8');
const CODE_REVIEW = readFileSync('.github/workflows/code-review.yml', 'utf8');
const ACTION = readFileSync('.github/actions/code-reviewer/action.yml', 'utf8');

const jobBlock = (source, jobId) => {
  const jobsAt = source.search(/^jobs:\s*$/m);
  assert.notEqual(jobsAt, -1, 'workflow has no jobs:');
  const body = source.slice(jobsAt);
  const start = body.search(new RegExp(`^ {2}${jobId}:\\s*$`, 'm'));
  assert.notEqual(start, -1, `no job named ${jobId}`);
  const rest = body.slice(start + 1);
  const next = rest.search(/^ {2}[a-z0-9][a-z0-9-]*:\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
};

const stepNamed = (job, name) => {
  const start = job.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `no step named ${name}`);
  const rest = job.slice(start);
  const next = rest.search(/\n {6}- name: /);
  return next === -1 ? rest : rest.slice(0, next);
};

test('applying the review:* label cannot fail the Review Tier check', () => {
  const classify = jobBlock(REVIEW_TIER, 'classify');
  const apply = stepNamed(classify, 'Apply the review tier label');
  assert.match(
    apply,
    /continue-on-error:\s*true/,
    'the label is a display of the job output (ADR 0070 item 3); a GraphQL flake must not fail the required check',
  );
  assert.match(apply, /apply-review-tier-label\.mjs/);
  assert.doesNotMatch(
    apply,
    /gh label list --search/,
    'GitHub label search is an extra flaky round-trip the closed review:* set does not need',
  );
  // Comments sit above `- name:`, so the step extractor does not see them.
  assert.match(
    classify,
    /104334970928/,
    'run 151 GraphQL flake after classify',
  );
  assert.match(
    classify,
    /104326339851/,
    'run 147 Review Tier job with no runner',
  );
  assert.match(
    classify,
    /104326383163/,
    "same SHA's Agent Review Ran job, not Review Tier",
  );
  assert.match(
    classify,
    /docs\/research\/2026-09-18-review-tier-intermittent-failures\.md/,
  );
});

test('code-review never passes an empty --tier to the validator or publisher', () => {
  const review = jobBlock(CODE_REVIEW, 'review');
  const classify = stepNamed(review, 'Classify the diff');
  assert.match(
    classify,
    /label=review:human/,
    'a classifier that dies before finish() must still emit a human tier',
  );
  assert.match(
    CODE_REVIEW,
    /TIER: \$\{\{ needs\.review\.outputs\.tier \|\| 'review:human' \}\}/,
  );
  assert.match(
    review,
    /tier: \$\{\{ steps\.tier\.outputs\.label \|\| 'review:human' \}\}/,
  );
  assert.match(
    ACTION,
    /if \[ -z '\$\{\{ inputs\.tier \}\}' \] \|\| \[ '\$\{\{ inputs\.tier \}\}' = 'null' \]; then/,
    "empty string is not the sentinel `null` and used to reach `--tier ''`",
  );
});
