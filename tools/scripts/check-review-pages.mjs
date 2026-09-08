#!/usr/bin/env node
// Asserts that docs/review/finding-lifecycle.html still describes the review
// pipeline the code implements (ADR 0070, ADR 0071).
//
//   node tools/scripts/check-review-pages.mjs
//
// The page embeds a manifest of the vocabularies it asserts. This diffs each
// entry against its source: the finding contract's exported constants, the CI
// job names the main-branch ruleset requires, the Agent Verdict job name in
// the code-review workflow, and the gate tier labels in the label catalog. A
// rename in any of those fails here instead of leaving a confidently wrong
// explainer in docs/.
//
// Exit 0 = in sync. Exit 1 = drift (fix the page or the source). Exit 2 = the
// check could not run.
import { existsSync, readFileSync } from 'node:fs';

import {
  FINDING_AXES,
  FINDING_EVIDENCE_KINDS,
  FINDING_IDENTITY_FIELDS,
  FINDING_SEVERITIES,
  GATE_TIER_LABELS,
  REVIEW_TIER_LABELS,
  VERDICT_VALUES,
} from './review/schema.mjs';

const PAGE = 'docs/review/finding-lifecycle.html';
const MANIFEST_ID = 'review-lifecycle-manifest';
const CI_WORKFLOW = '.github/workflows/ci.yml';
const REVIEW_WORKFLOW = '.github/workflows/code-review.yml';
const LABELS = 'tools/config/github-labels.json';

/**
 * The status-check context the code-review workflow produces (ADR 0070 item
 * 6). Not in the ruleset yet; the page describes it, so the page must name
 * the job that actually exists.
 */
export const AGENT_VERDICT_CHECK = 'Agent Verdict';

/**
 * The status-check contexts the `*main*` ruleset requires. The ruleset lives
 * in GitHub, not in a file, so this list is the repo-side statement of it; the
 * page asserts the same six, and each must still be a job name in ci.yml.
 */
export const REQUIRED_CHECK_CONTEXTS = [
  'Authoritative Lockfile Policy',
  'Secure Install Review',
  'Prepare Dependency Cache',
  'Setup Affected Context',
  'Lint',
  'Test',
];

const fail = (msg) => {
  console.error(`review-pages: ${msg}`);
  process.exit(2);
};

if (!existsSync(PAGE)) fail(`${PAGE} not found`);
if (!existsSync(CI_WORKFLOW)) fail(`${CI_WORKFLOW} not found`);
if (!existsSync(REVIEW_WORKFLOW)) fail(`${REVIEW_WORKFLOW} not found`);
if (!existsSync(LABELS)) fail(`${LABELS} not found`);

const page = readFileSync(PAGE, 'utf8');
const raw = page.match(
  new RegExp(
    `<script type="application/json" id="${MANIFEST_ID}">([\\s\\S]*?)</script>`,
  ),
);
if (!raw) fail(`no #${MANIFEST_ID} block in ${PAGE}`);

let manifest;
try {
  manifest = JSON.parse(raw[1]);
} catch (err) {
  fail(`#${MANIFEST_ID} is not valid JSON: ${err.message}`);
}

const jobNames = (workflow) =>
  new Set(
    [...readFileSync(workflow, 'utf8').matchAll(/^\s{4}name: (.+)$/gm)].map(
      (m) => m[1].trim(),
    ),
  );
const ciJobNames = jobNames(CI_WORKFLOW);
const reviewJobNames = jobNames(REVIEW_WORKFLOW);
const gateTierLabelsInCatalog = JSON.parse(readFileSync(LABELS, 'utf8'))
  .orchestration.map((l) => l.name)
  .filter((n) => n.startsWith('gate:'));

const findings = [];
const eqList = (key, expected, actual) => {
  const want = JSON.stringify([...expected]);
  const got = JSON.stringify(actual ?? null);
  if (want !== got)
    findings.push(`${key}: source says ${want}, page says ${got}`);
};

eqList('reviewTierLabels', REVIEW_TIER_LABELS, manifest.reviewTierLabels);
eqList('findingSeverities', FINDING_SEVERITIES, manifest.findingSeverities);
eqList(
  'findingEvidenceKinds',
  FINDING_EVIDENCE_KINDS,
  manifest.findingEvidenceKinds,
);
eqList('findingAxes', FINDING_AXES, manifest.findingAxes);
eqList('verdictValues', VERDICT_VALUES, manifest.verdictValues);
eqList(
  'findingIdentityFields',
  FINDING_IDENTITY_FIELDS,
  manifest.findingIdentityFields,
);
eqList(
  'requiredCheckContexts',
  REQUIRED_CHECK_CONTEXTS,
  manifest.requiredCheckContexts,
);
eqList('gateTierLabels', GATE_TIER_LABELS, manifest.gateTierLabels);

for (const context of REQUIRED_CHECK_CONTEXTS) {
  if (!ciJobNames.has(context))
    findings.push(
      `requiredCheckContexts: "${context}" is not a job name in ${CI_WORKFLOW}`,
    );
}
eqList('gateTierLabels (catalog)', GATE_TIER_LABELS, gateTierLabelsInCatalog);

if (manifest.agentVerdictCheck !== AGENT_VERDICT_CHECK)
  findings.push(
    `agentVerdictCheck: source says ${JSON.stringify(AGENT_VERDICT_CHECK)}, page says ${JSON.stringify(manifest.agentVerdictCheck ?? null)}`,
  );
if (!reviewJobNames.has(AGENT_VERDICT_CHECK))
  findings.push(
    `agentVerdictCheck: "${AGENT_VERDICT_CHECK}" is not a job name in ${REVIEW_WORKFLOW}`,
  );

// Every vocabulary word the manifest asserts must also be visible in the page
// body, or the manifest is decoration rather than a description of the picture.
const body = page.replace(raw[0], '');
for (const word of [
  ...REVIEW_TIER_LABELS,
  ...FINDING_SEVERITIES,
  ...FINDING_EVIDENCE_KINDS,
  ...VERDICT_VALUES,
  AGENT_VERDICT_CHECK,
]) {
  if (!body.includes(word))
    findings.push(`"${word}" is in the manifest but nowhere in the page body`);
}

if (findings.length) {
  console.error(
    `review-pages: ${findings.length} finding(s) — ${PAGE} is out of date`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `review-pages: OK — ${PAGE} matches the finding contract, ${REQUIRED_CHECK_CONTEXTS.length} required checks, the ${AGENT_VERDICT_CHECK} job, and ${GATE_TIER_LABELS.length} gate tier labels`,
);
