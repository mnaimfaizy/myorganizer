/**
 * Run with: yarn sandcastle:resume:test  (node --test, matching the other libs here)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DISCARD_FLAG,
  RESUME_GUARDRAILS,
  SLICE_DISPOSITIONS,
  buildResumeBrief,
  decideSliceDisposition,
  isDiscardRequested,
  planWaveForwarding,
  validateDiscardScope,
} from './sandcastle-resume.mjs';

const usableCheckpoint = {
  branchExists: true,
  commitsAhead: 1,
  mergeBaseMatchesBase: true,
};

test('resumes a slice branch carrying a usable checkpoint', () => {
  assert.equal(
    decideSliceDisposition(usableCheckpoint),
    SLICE_DISPOSITIONS.resume,
  );
});

test('starts fresh when the slice branch does not exist', () => {
  assert.equal(
    decideSliceDisposition({
      branchExists: false,
      commitsAhead: 0,
      mergeBaseMatchesBase: true,
    }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('starts fresh when the branch exists but carries no work', () => {
  assert.equal(
    decideSliceDisposition({
      branchExists: true,
      commitsAhead: 0,
      mergeBaseMatchesBase: true,
    }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('a checkpoint based on a superseded head is skipped, never resumed', () => {
  assert.equal(
    decideSliceDisposition({
      branchExists: true,
      commitsAhead: 3,
      mergeBaseMatchesBase: false,
    }),
    SLICE_DISPOSITIONS.skipStale,
  );
});

test('a stale checkpoint is skipped rather than destroyed', () => {
  // The distinction that matters: skip-stale leaves the branch alone. Returning
  // `fresh` here would delete work the maintainer has never seen.
  assert.notEqual(
    decideSliceDisposition({
      branchExists: true,
      commitsAhead: 3,
      mergeBaseMatchesBase: false,
    }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('an explicit discard outranks a usable checkpoint', () => {
  assert.equal(
    decideSliceDisposition({ ...usableCheckpoint, discardRequested: true }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('an explicit discard also overrides a stale checkpoint', () => {
  assert.equal(
    decideSliceDisposition({
      branchExists: true,
      commitsAhead: 3,
      mergeBaseMatchesBase: false,
      discardRequested: true,
    }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('a non-numeric commit count is treated as no work rather than resumed', () => {
  // rev-list output can be empty when the ref is unreadable. Guessing "resume" there
  // would hand an agent a brief describing a checkpoint that is not present.
  assert.equal(
    decideSliceDisposition({
      branchExists: true,
      commitsAhead: Number.NaN,
      mergeBaseMatchesBase: true,
    }),
    SLICE_DISPOSITIONS.fresh,
  );
});

test('the resume brief carries all five guardrails', () => {
  const brief = buildResumeBrief({
    basePrompt: 'BASE PROMPT BODY',
    issueNumber: 396,
    sliceBranch: 'slice/396-example',
    checkpoint: { sha: '1f056fa', files: ['a.ts', 'b.ts'] },
  });

  assert.equal(RESUME_GUARDRAILS.length, 5);
  for (const guardrail of RESUME_GUARDRAILS) {
    assert.ok(
      brief.includes(guardrail),
      `resume brief dropped a guardrail: ${guardrail}`,
    );
  }
});

test('the resume brief states that existing files do not satisfy a pipeline', () => {
  // The rationalization this exists to close: a resumed agent finding a spec file in
  // the tree and concluding the Jest pipeline already ran.
  const brief = buildResumeBrief({
    basePrompt: 'BASE',
    issueNumber: 1,
    sliceBranch: 'slice/1-x',
    checkpoint: { sha: 'abc1234', files: ['x.spec.ts'] },
  });

  assert.match(brief, /do NOT satisfy a Gated Pipeline/);
  assert.match(brief, /does not mean TestScaffold ran/);
});

test('the resume brief preserves the original prompt', () => {
  const brief = buildResumeBrief({
    basePrompt: 'ORIGINAL SLICE BRIEF CONTENTS',
    issueNumber: 7,
    sliceBranch: 'slice/7-y',
    checkpoint: { sha: 'deadbee', files: [] },
  });

  assert.ok(brief.includes('ORIGINAL SLICE BRIEF CONTENTS'));
});

test('the resume brief names the branch, sha and file inventory', () => {
  const brief = buildResumeBrief({
    basePrompt: 'BASE',
    issueNumber: 42,
    sliceBranch: 'slice/42-z',
    checkpoint: { sha: 'cafe123', files: ['apps/a.ts', 'libs/b.ts'] },
  });

  assert.ok(brief.includes('slice/42-z'));
  assert.ok(brief.includes('cafe123'));
  assert.ok(brief.includes('apps/a.ts'));
  assert.ok(brief.includes('libs/b.ts'));
  assert.match(brief, /#42/);
});

test('the resume brief degrades when the file list is unavailable', () => {
  const brief = buildResumeBrief({
    basePrompt: 'BASE',
    issueNumber: 9,
    sliceBranch: 'slice/9-w',
    checkpoint: { sha: 'beef456' },
  });

  assert.match(brief, /file list unavailable/);
});

test('the resume brief does not inline the diff', () => {
  // Spending the context budget on a diff the agent can read from git in one command
  // defeats the point of resuming rather than restarting.
  const brief = buildResumeBrief({
    basePrompt: 'BASE',
    issueNumber: 3,
    sliceBranch: 'slice/3-q',
    checkpoint: { sha: 'aaa111', files: ['f.ts'] },
  });

  assert.ok(!brief.includes('diff --git'));
  assert.match(brief, /git show aaa111/);
});

// ─── Discarding a checkpoint ──────────────────────────────────────────────────

const argv = (...args) => ['node', 'main.mts', ...args];

test('the discard flag is recognised in argv', () => {
  assert.equal(isDiscardRequested(argv('--prd', '401', DISCARD_FLAG)), true);
  assert.equal(isDiscardRequested(argv('--prd', '401')), false);
});

test('a discard in PRD mode must name the slice it applies to', () => {
  const result = validateDiscardScope({
    discardRequested: true,
    mode: 'prd',
    issueNumber: undefined,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /--issue/);
});

test('a discard in PRD mode is accepted when a slice is targeted', () => {
  assert.equal(
    validateDiscardScope({
      discardRequested: true,
      mode: 'prd',
      issueNumber: 396,
    }).ok,
    true,
  );
});

test('a discard is refused in sweep mode', () => {
  // A sweep selects work nobody named, so a blanket discard would destroy
  // checkpoints the maintainer has never looked at.
  const result = validateDiscardScope({
    discardRequested: true,
    mode: 'sweep',
  });

  assert.equal(result.ok, false);
});

test('issue mode accepts a discard — the issue is already the target', () => {
  assert.equal(
    validateDiscardScope({
      discardRequested: true,
      mode: 'issue',
      issueNumber: 42,
    }).ok,
    true,
  );
});

test('no discard requested is always in scope', () => {
  for (const mode of ['prd', 'issue', 'sweep']) {
    assert.equal(
      validateDiscardScope({ discardRequested: false, mode }).ok,
      true,
    );
  }
});

// ─── Wave driver forwarding ───────────────────────────────────────────────────

test('the wave driver refuses the discard flag', () => {
  const result = planWaveForwarding(argv('--prd', '401', DISCARD_FLAG));

  assert.equal(result.ok, false);
  assert.match(result.message, /not accepted by the wave driver/);
});

test('the wave driver refusal names the single-slice command to use instead', () => {
  const result = planWaveForwarding(argv('--prd', '401', DISCARD_FLAG));

  assert.match(result.message, /--issue <slice>/);
  assert.match(result.message, /dispatch-waves\.mts --prd/);
});

test('the wave driver never forwards the discard flag', () => {
  const result = planWaveForwarding(argv('--prd', '401', DISCARD_FLAG));

  assert.equal(result.ok, false);
  assert.deepEqual(result.forwarded, []);
  assert.equal(result.forwarded.includes(DISCARD_FLAG), false);
});

test('the wave driver forwards flags it does not own', () => {
  const result = planWaveForwarding(
    argv('--prd', '401', '--agent', 'cursor', '--model', 'x'),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.forwarded, ['--agent', 'cursor', '--model', 'x']);
});

test('the wave driver keeps its own flags to itself', () => {
  const result = planWaveForwarding(
    argv('--prd', '401', '--plan', '--agent', 'copilot'),
  );

  assert.equal(result.ok, true);
  assert.equal(result.forwarded.includes('--prd'), false);
  assert.equal(result.forwarded.includes('401'), false);
  assert.equal(result.forwarded.includes('--plan'), false);
  assert.deepEqual(result.forwarded, ['--agent', 'copilot']);
});
