#!/usr/bin/env node
// Runs the three decisions of Staging's web deploy for deploy-staging.yml
// (issue #1138, ADR 0128). The logic lives in lib/staging-web-deploy.mjs; this
// file only reads arguments, the bundle and the network, and reports.
//
//   node tools/scripts/staging-web-deploy.mjs same-site <webOrigin> <apiOrigin>
//   node tools/scripts/staging-web-deploy.mjs schedule --sha <greenSha> [--web-origin <origin>]
//   node tools/scripts/staging-web-deploy.mjs plan --web-origin <origin> --sha <sha> --bundle <dir>
//   node tools/scripts/staging-web-deploy.mjs probe --web-origin <origin> --sha <sha> [--timeout-seconds 300]
//
// `schedule` decides whether a scheduled run deploys the newest green commit
// (see decideSchedule). It asks git whether that commit is an ancestor of the
// one Staging holds, so it runs in a checkout with full history. It prints the
// decision, appends `proceed=<true|false>` to $GITHUB_OUTPUT and a line to
// $GITHUB_STEP_SUMMARY when set, and exits 1 only when the commit is uploaded
// but not running.
//
// `plan` writes <bundle>/public/deploy-state.json, prints `restart` or
// `install-owed`, and appends `action=<value>` to $GITHUB_OUTPUT when set.
// It refuses, before any request, a bundle that carries public/.htaccess:
// that file would overwrite the host's own.
//
// Both origins are GitHub Environment secrets (ADR 0056), so no message
// printed here contains one — only a path such as /login or /sw.js.
//
// Exit 0 = same site / schedule decided / plan written / build is live.
// Exit 1 = different sites, a commit uploaded but not running, a refused
// input, or the probe failed. Exit 2 = bad invocation.
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  BUNDLE_HTACCESS,
  SCHEDULE_OUTCOMES,
  StagingWebDeployRefusal,
  assertBundleKeepsHostHtaccess,
  isSameSite,
  planDeploy,
  planSchedule,
  probeDeploy,
} from './lib/staging-web-deploy.mjs';

const NAME = 'staging-web-deploy';
const REQUEST_TIMEOUT_MS = 20_000;

const usage = (msg) => {
  console.error(`${NAME}: ${msg}`);
  process.exit(2);
};

/** Global fetch with a per-request timeout, so one hung socket cannot stall the job. */
const fetcher = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    if (!name?.startsWith('--') || args[i + 1] === undefined) {
      usage(`expected --flag value pairs, got ${JSON.stringify(name)}`);
    }
    flags[name.slice(2)] = args[i + 1];
  }
  return flags;
}

function required(flags, name) {
  if (!flags[name]) usage(`missing --${name}`);
  return flags[name];
}

const git = (...args) => spawnSync('git', args, { stdio: 'ignore' }).status;

/** False when git does not know `descendant`: unknown is not "newer". */
const isAncestor = (ancestor, descendant) =>
  git('cat-file', '-e', `${descendant}^{commit}`) === 0 &&
  git('merge-base', '--is-ancestor', ancestor, descendant) === 0;

const [, , command, ...rest] = process.argv;

async function main() {
  if (command === 'same-site') {
    const [webOrigin, apiOrigin] = rest;
    if (!webOrigin || !apiOrigin) usage('same-site needs two origins');
    if (isSameSite(webOrigin, apiOrigin)) {
      console.log(`${NAME}: the web app and the API are on the same site`);
      return 0;
    }
    console.error(
      `${NAME}: the web origin and the API origin are on different sites ` +
        '(their last two hostname labels differ). The browser does not send ' +
        'the refresh cookie across sites, so sign-in would not survive ' +
        'closing and reopening the web app. Host both under one domain.',
    );
    return 1;
  }

  if (command === 'schedule') {
    const flags = parseFlags(rest);
    const decision = await planSchedule({
      fetcher,
      // Optional on purpose: an unset address is "nothing known", not an error.
      webOrigin: flags['web-origin'] ?? '',
      greenSha: required(flags, 'sha'),
      isAncestor,
    });
    const outcome = SCHEDULE_OUTCOMES[decision];

    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `proceed=${outcome.proceed}\ndecision=${decision}\n`,
      );
    }
    if (outcome.summary && process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${outcome.summary}\n`);
    }
    console.log(decision);
    if (outcome.failed) {
      console.error(`${NAME}: ${outcome.summary}`);
      return 1;
    }
    return 0;
  }

  if (command === 'plan') {
    const flags = parseFlags(rest);
    const webOrigin = required(flags, 'web-origin');
    const sha = required(flags, 'sha');
    const bundle = required(flags, 'bundle');

    const packageJsonPath = join(bundle, 'package.json');
    if (!existsSync(packageJsonPath)) usage(`${packageJsonPath} not found`);

    assertBundleKeepsHostHtaccess(
      existsSync(join(bundle, BUNDLE_HTACCESS)) ? [BUNDLE_HTACCESS] : [],
    );

    // The probe waits for this commit in the running HTML. A bundle built
    // under another id would upload, restart, and then never satisfy it.
    const buildIdPath = join(bundle, '.next', 'BUILD_ID');
    const buildId = existsSync(buildIdPath)
      ? readFileSync(buildIdPath, 'utf8').trim()
      : null;
    if (buildId !== sha) {
      console.error(
        `${NAME}: the bundle's build id is not the commit being deployed. ` +
          'Package it with WEB_BUILD_ID set to that commit.',
      );
      return 1;
    }

    const { action, state } = await planDeploy({
      fetcher,
      webOrigin,
      sha,
      packageJson: JSON.parse(readFileSync(packageJsonPath, 'utf8')),
    });

    mkdirSync(join(bundle, 'public'), { recursive: true });
    writeFileSync(
      join(bundle, 'public', 'deploy-state.json'),
      `${JSON.stringify(state, null, 2)}\n`,
    );
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `action=${action}\n`);
    }
    console.log(action);
    return 0;
  }

  if (command === 'probe') {
    const flags = parseFlags(rest);
    const timeoutSeconds = Number(flags['timeout-seconds'] ?? 300);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      usage('--timeout-seconds must be a positive number');
    }
    const result = await probeDeploy({
      fetcher,
      webOrigin: required(flags, 'web-origin'),
      sha: required(flags, 'sha'),
      timeoutSeconds,
    });
    if (!result.ok) {
      console.error(`${NAME}: probe failed - ${result.reason}`);
      return 1;
    }
    console.log(
      `${NAME}: the uploaded build is answering (${result.attempts} attempt(s)) and /sw.js carries its headers`,
    );
    return 0;
  }

  return usage(
    `unknown command ${JSON.stringify(command)} (expected same-site, schedule, plan or probe)`,
  );
}

try {
  process.exit(await main());
} catch (err) {
  if (err instanceof StagingWebDeployRefusal) {
    console.error(`${NAME}: refused - ${err.message}`);
    process.exit(1);
  }
  throw err;
}
