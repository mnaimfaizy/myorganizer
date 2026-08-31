#!/usr/bin/env node
// Asserts the CI-owned Host Apply job (ADR 0056, issue #567) keeps the shape
// its acceptance criteria promise, read straight from the two workflow files
// rather than from a doc page: `host-apply` needs the backend upload job,
// runs under the right GitHub Environment, is reachable by an apply-only
// `workflow_dispatch` without re-running the upload jobs, staging's apply
// group never cancels in progress while its upload group still can, and no
// `secrets.*` reference in the job falls outside the documented allowlist
// (`DATABASE_URL` is never one of them, anywhere in either file). It also
// pins the two hardening decisions the wiring depends on: ssh verifies the
// host against pinned keys, and the captured output passes the redaction
// scrubber before anything prints it.
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

/** The job's own `if:` line, or null when the job has none. */
function ifLineOf(path, jobId) {
  const block = jobBlock(path, jobId);
  const match = block.match(/^\s*if:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * #567's acceptance criteria: an apply-only `workflow_dispatch` "re-runs Host
 * Apply without a second upload." The upload jobs must therefore skip
 * themselves on that dispatch — asserted here as a negated `apply_only`
 * reference in the job's own `if:`, since that's the only place the behavior
 * lives (nothing else in the file pins it).
 */
function checkNoApplyOnlyReRun(path, jobId) {
  const ifLine = ifLineOf(path, jobId);
  if (ifLine === null) return;
  if (!/!\s*inputs\.apply_only/.test(ifLine)) {
    findings.push(`${path}: ${jobId}'s if: does not skip on apply_only re-run`);
  }
}

/**
 * The other half of the same acceptance criterion: `host-apply` must still
 * be reachable on an apply-only dispatch even though the upload jobs it
 * `needs:` are skipped. Strip every negated `apply_only` reference out of the
 * `if:` line and confirm a positive one survives.
 */
function checkHostApplyRunsOnApplyOnly(path) {
  const ifLine = ifLineOf(path, 'host-apply');
  if (ifLine === null) {
    findings.push(`${path}: host-apply declares no if: condition`);
    return;
  }
  const withoutNegated = ifLine.replace(/!\s*inputs\.apply_only/g, '');
  if (!/inputs\.apply_only/.test(withoutNegated)) {
    findings.push(
      `${path}: host-apply's if: has no path that runs on an apply_only-only dispatch`,
    );
  }
}

/** A job's own `concurrency:` block as `{ group, cancel }`, or null. */
function concurrencyOf(path, jobId) {
  const block = jobBlock(path, jobId);
  const match = block.match(
    /concurrency:\s*\n\s*group:\s*(\S+)\s*\n\s*cancel-in-progress:\s*(true|false)/,
  );
  if (!match) {
    findings.push(
      `${path}: ${jobId} declares no concurrency group with a cancel-in-progress`,
    );
    return null;
  }
  return { group: match[1], cancel: match[2] === 'true' };
}

/**
 * Staging's upload and apply must share one group that never cancels.
 *
 * ADR 0056 rules out cancelling an in-flight `prisma migrate deploy`, which a
 * non-cancelling group for `host-apply` alone achieves — but leaves the other
 * half open: with the upload in a separate group, a newer `main` run's
 * `deploy-backend` starts immediately and FTPs a new bundle into the same
 * `APP_ROOT` that the older run's `npm ci` and `prisma migrate deploy` are
 * still working in. One shared, queueing group closes both.
 *
 * `deploy-frontend` deliberately stays in the cancelling `deploy-staging`
 * group: it ships to a different target and never touches `APP_ROOT`.
 */
function checkStagingApplyGroup() {
  const upload = concurrencyOf(STAGING, 'deploy-backend');
  const apply = concurrencyOf(STAGING, 'host-apply');
  if (!upload || !apply) return;

  if (upload.group !== apply.group) {
    findings.push(
      `${STAGING}: deploy-backend (${upload.group}) and host-apply (${apply.group}) hold different concurrency groups - an upload could land in APP_ROOT while an apply is still running there`,
    );
  }

  for (const [jobId, concurrency] of [
    ['deploy-backend', upload],
    ['host-apply', apply],
  ]) {
    if (concurrency.cancel) {
      findings.push(
        `${STAGING}: ${jobId}'s cancel-in-progress is true, expected false - a newer run must queue behind an in-flight apply, never cancel it`,
      );
    }
  }
}

/**
 * The runner is ephemeral, so `StrictHostKeyChecking=accept-new` would trust
 * whatever key answered on every single run — trust-on-first-use with no
 * memory is not trust at all. The host keys are pinned as `SSH_KNOWN_HOSTS`.
 */
function checkSshHostKeyPinning(path) {
  const block = jobBlock(path, 'host-apply');
  if (/StrictHostKeyChecking=(?!yes\b)/.test(block)) {
    findings.push(
      `${path}: host-apply's ssh does not set StrictHostKeyChecking=yes`,
    );
  }
  if (!/UserKnownHostsFile=/.test(block)) {
    findings.push(
      `${path}: host-apply's ssh sets no UserKnownHostsFile, so SSH_KNOWN_HOSTS is never consulted`,
    );
  }
}

/**
 * PRD #565 user story 30: a public Actions log is not a secret store. The SSH
 * step must capture its output to a file rather than stream it, and the job
 * must hand that file to the scrubber, which is what decides whether it prints.
 * Streaming would put a leaked value in the log before anything could grade it.
 */
function checkLogIsScrubbedBeforePrinting(path) {
  const block = jobBlock(path, 'host-apply');
  // Both stdout and stderr must land in the file. Matching the redirect alone
  // would also match the `: >` line that truncates it, which redirects nothing.
  if (!/>\s*"\$RUNNER_TEMP\/host-apply\.log"\s*2>&1/.test(block)) {
    findings.push(
      `${path}: host-apply's ssh step streams its output instead of capturing it to host-apply.log`,
    );
  }
  if (!/scrub-host-apply-log\.mjs/.test(block)) {
    findings.push(
      `${path}: host-apply never runs scrub-host-apply-log.mjs over the captured output`,
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
checkNoApplyOnlyReRun(STAGING, 'deploy-backend');
checkNoApplyOnlyReRun(STAGING, 'deploy-frontend');
checkNoApplyOnlyReRun(PRODUCTION, 'deploy-backend');
checkNoApplyOnlyReRun(PRODUCTION, 'deploy-frontend');
checkHostApplyRunsOnApplyOnly(STAGING);
checkHostApplyRunsOnApplyOnly(PRODUCTION);
checkStagingApplyGroup();
checkSshHostKeyPinning(STAGING);
checkSshHostKeyPinning(PRODUCTION);
checkLogIsScrubbedBeforePrinting(STAGING);
checkLogIsScrubbedBeforePrinting(PRODUCTION);
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
