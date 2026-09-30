#!/usr/bin/env node
// Asserts that tools/config/review-golden-set.json is a golden set the
// replay can run (ADR 0071, Consequences).
//
//   node tools/scripts/check-review-golden-set.mjs
//
// Four things rot here and each is checked: the set's shape (ids, SHAs,
// patterns, minimum recall), the commit ranges (both ends must exist and
// the head must be reachable from main, or the replay reviews nothing),
// and the replay workflow's triggers, which must be the ones ADR 0109 names —
// a weekly schedule that asks which reviewer inputs moved, the golden-replay
// Request Label, and dispatch — and never a push to a Pull Request, which
// bought most of three weeks' replay spend on runs nobody asked to measure.
// Which inputs the schedule watches is REPLAY_INPUT_PATHS in golden-tiers.mjs,
// covered by its own tests.
// And the replay checks the reviewer's obligation answer sheet before it
// scores, as production does, or a run production would fail as a pipeline
// fault is recorded as a miss (ADR 0101).
//
// Exit 0 = sound. Exit 1 = findings. Exit 2 = could not run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import {
  GoldenSetError,
  REVIEW_GOLDEN_SET_PATH,
  loadGoldenSet,
  replayObligationCheckFindings,
  replayTriggerFindings,
} from './review/golden.mjs';
import { REPLAY_INPUT_PATHS } from './review/golden-tiers.mjs';

const REPLAY_WORKFLOW = '.github/workflows/review-golden-replay.yml';
const fail = (msg) => {
  console.error(`review-golden-set: ${msg}`);
  process.exit(2);
};
const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).status === 0;

let set;
try {
  set = loadGoldenSet();
} catch (err) {
  if (err instanceof GoldenSetError) {
    console.error(`review-golden-set: ${err.message}`);
    process.exit(1);
  }
  fail(`cannot load ${REVIEW_GOLDEN_SET_PATH}: ${err.message}`);
}
if (!existsSync(REPLAY_WORKFLOW)) fail(`${REPLAY_WORKFLOW} not found`);

const findings = [];

const shallow =
  spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
    encoding: 'utf8',
  }).stdout.trim() === 'true';
if (shallow) {
  console.log(
    'review-golden-set: shallow clone, commit ranges not checked here',
  );
} else {
  const mainRef = git(['rev-parse', '--verify', '--quiet', 'origin/main'])
    ? 'origin/main'
    : 'main';
  for (const c of set.cases) {
    for (const [end, sha] of [
      ['base', c.base],
      ['head', c.head],
    ]) {
      if (!git(['cat-file', '-e', `${sha}^{commit}`]))
        findings.push(
          `${c.id}: ${end} ${sha.slice(0, 7)} is not in this clone`,
        );
    }
    if (
      git(['cat-file', '-e', `${c.head}^{commit}`]) &&
      !git(['merge-base', '--is-ancestor', c.head, mainRef])
    )
      findings.push(
        `${c.id}: head ${c.head.slice(0, 7)} is not reachable from ${mainRef}; a squash merge needs the squash commit and its parent`,
      );
    if (
      git(['cat-file', '-e', `${c.base}^{commit}`]) &&
      git(['cat-file', '-e', `${c.head}^{commit}`]) &&
      !git(['merge-base', '--is-ancestor', c.base, c.head])
    )
      findings.push(`${c.id}: base is not an ancestor of head`);
  }
}

const workflow = readFileSync(REPLAY_WORKFLOW, 'utf8');
for (const f of replayTriggerFindings(workflow))
  findings.push(`${REPLAY_WORKFLOW}: ${f}`);

for (const f of replayObligationCheckFindings(workflow))
  findings.push(`${REPLAY_WORKFLOW}: ${f}`);

if (findings.length) {
  console.error(
    `review-golden-set: ${findings.length} finding(s) across ${set.cases.length} case(s)`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `review-golden-set: OK — ${set.cases.length} case(s), ${set.cases.reduce((n, c) => n + c.expected.length, 0)} expected finding(s), replay runs on schedule and request over ${REPLAY_INPUT_PATHS.length} input path(s) and checks answer sheets before scoring`,
);
