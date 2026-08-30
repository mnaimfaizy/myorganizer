#!/usr/bin/env node
// Asserts the CI-owned Host Apply job (ADR 0056, issue #567) keeps the shape
// its acceptance criteria promise, read straight from the two workflow files
// rather than from a doc page: `host-apply` needs the backend upload job,
// runs under the right GitHub Environment, is reachable by an apply-only
// `workflow_dispatch`, staging's apply group never cancels in progress while
// its upload group still can, and no `secrets.*` reference in the job falls
// outside the documented allowlist (`DATABASE_URL` is never one of them,
// anywhere in either file).
//
//   node tools/scripts/check-host-apply-workflow.mjs [repoRoot]
//
// Exit 0 = every assertion holds. Exit 1 = a workflow drifted from the
// contract. Exit 2 = the check could not run.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { HOST_APPLY_SECRET_NAMES } from './lib/host-apply.mjs';

const ROOT = resolve(process.argv[2] ?? '.');
const WORKFLOWS = join('.github', 'workflows');
const STAGING = join(WORKFLOWS, 'deploy-staging.yml');
const PRODUCTION = join(WORKFLOWS, 'deploy-production.yml');

const fail = (msg) => {
  console.error(`host-apply-workflow: ${msg}`);
  process.exit(2);
};

const fileCache = new Map();
const read = (path) => {
  if (!fileCache.has(path)) {
    const full = join(ROOT, path);
    if (!existsSync(full)) fail(`${path} not found`);
    fileCache.set(path, readFileSync(full, 'utf8'));
  }
  return fileCache.get(path);
};

/** Slices one job out of a workflow (same approach as check-deploy-pipeline.mjs). */
const jobBlock = (path, jobId) => {
  const source = read(path);
  const jobsAt = source.search(/^jobs:\s*$/m);
  if (jobsAt === -1) fail(`${path} has no top-level jobs: key`);

  const body = source.slice(jobsAt);
  const start = body.search(new RegExp(`^ {2}${jobId}:\\s*$`, 'm'));
  if (start === -1) fail(`${path} has no job named ${jobId}`);

  const rest = body.slice(start + 1);
  const next = rest.search(/^ {2}[a-z0-9][a-z0-9-]*:\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
};

const findings = [];

function checkEnvironment(path, environment) {
  const block = jobBlock(path, 'host-apply');
  if (
    !new RegExp(`^\\s*environment:\\s*${environment}\\s*$`, 'm').test(block)
  ) {
    findings.push(
      `${path}: host-apply does not declare environment: ${environment}`,
    );
  }
}

function checkNeedsBackendUpload(path) {
  const block = jobBlock(path, 'host-apply');
  const match = block.match(/^\s*needs:\s*(.+)$/m);
  if (!match) {
    findings.push(`${path}: host-apply declares no needs:`);
    return;
  }
  if (!match[1].includes('deploy-backend')) {
    findings.push(
      `${path}: host-apply's needs (${match[1].trim()}) does not include deploy-backend`,
    );
  }
}

/** The `workflow_dispatch:` block only, so `apply_only` isn't confused with a same-named job step. */
function checkApplyOnlyDispatchInput(path) {
  const source = read(path);
  const dispatchAt = source.search(/^\s*workflow_dispatch:\s*$/m);
  if (dispatchAt === -1) {
    findings.push(`${path}: declares no workflow_dispatch trigger`);
    return;
  }

  const body = source.slice(dispatchAt);
  const next = body.slice(1).search(/^\S/m);
  const dispatchBlock = next === -1 ? body : body.slice(0, next + 1);

  if (!/^\s*apply_only:\s*$/m.test(dispatchBlock)) {
    findings.push(`${path}: workflow_dispatch declares no apply_only input`);
  }
}

function cancelInProgressOf(path, jobId) {
  const block = jobBlock(path, jobId);
  const match = block.match(
    /concurrency:[\s\S]*?cancel-in-progress:\s*(true|false)/,
  );
  if (!match) {
    findings.push(
      `${path}: ${jobId} declares no concurrency cancel-in-progress`,
    );
    return null;
  }
  return match[1] === 'true';
}

function checkStagingConcurrencySplit() {
  const hostApplyCancels = cancelInProgressOf(STAGING, 'host-apply');
  if (hostApplyCancels === true) {
    findings.push(
      `${STAGING}: host-apply's concurrency cancel-in-progress is true, expected false`,
    );
  }

  const uploadCancels = cancelInProgressOf(STAGING, 'deploy-backend');
  if (uploadCancels === false) {
    findings.push(
      `${STAGING}: deploy-backend's concurrency cancel-in-progress is false, expected true`,
    );
  }
}

const secretNamesIn = (text) =>
  [...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);

/**
 * Checks both directions of the allowlist (PRD #565 Testing Decisions:
 * "extra or missing secrets.* names fail"): a name the job references that
 * isn't in `HOST_APPLY_SECRET_NAMES`, and a name in `HOST_APPLY_SECRET_NAMES`
 * the job never references at all — the latter catches a step accidentally
 * dropping, say, `API_ORIGIN` and silently losing the verify step's target.
 */
function checkSecretAllowlist(path) {
  const block = jobBlock(path, 'host-apply');
  const referenced = new Set(secretNamesIn(block));
  const allowed = new Set(HOST_APPLY_SECRET_NAMES);

  for (const name of referenced) {
    if (!allowed.has(name)) {
      findings.push(
        `${path}: host-apply references secrets.${name}, which is not in HOST_APPLY_SECRET_NAMES`,
      );
    }
  }

  for (const name of allowed) {
    if (!referenced.has(name)) {
      findings.push(
        `${path}: host-apply never references secrets.${name}, which HOST_APPLY_SECRET_NAMES requires`,
      );
    }
  }
}

function checkNoDatabaseUrlSecret(path) {
  if (/secrets\.DATABASE_URL\b/.test(read(path))) {
    findings.push(
      `${path}: references secrets.DATABASE_URL - DATABASE_URL must never be a GitHub secret`,
    );
  }
}

checkEnvironment(STAGING, 'staging');
checkEnvironment(PRODUCTION, 'production');
checkNeedsBackendUpload(STAGING);
checkNeedsBackendUpload(PRODUCTION);
checkApplyOnlyDispatchInput(STAGING);
checkApplyOnlyDispatchInput(PRODUCTION);
checkStagingConcurrencySplit();
checkSecretAllowlist(STAGING);
checkSecretAllowlist(PRODUCTION);
checkNoDatabaseUrlSecret(STAGING);
checkNoDatabaseUrlSecret(PRODUCTION);

if (findings.length > 0) {
  console.error(
    `host-apply-workflow: ${findings.length} finding(s) — the Host Apply wiring drifted from its contract\n`,
  );
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(
  'host-apply-workflow: staging and production Host Apply wiring in sync',
);
