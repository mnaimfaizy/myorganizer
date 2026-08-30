/**
 * Pure decision logic for CI-owned Host Apply (ADR 0056, issue #566).
 *
 * A failed migration and then a stale Prisma client both shipped to Production
 * because "go live" stayed on interactive SSH, run only when someone remembered.
 * This module is the part of that sequence CI can own without ever holding
 * `DATABASE_URL` itself: it takes the resolved values of the eight named
 * secrets (`HOST_APPLY_SECRET_NAMES`) from the caller — the GitHub Actions
 * workflow built in #567 — and produces the on-host command sequence, refuses
 * unsafe inputs, and can grade a captured log for a leaked credential.
 * `DATABASE_URL` is the one value this module never takes as input and never
 * emits: the generated script loads it on the host, at apply time, from the
 * selector store. It never opens a real SSH connection — verifying that
 * belongs to a live host, not a unit test.
 *
 * Run the tests with: yarn host-apply:test
 */

/** Refusal raised by a guard in this module. Never carries a secret value. */
export class HostApplyRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'HostApplyRefusal';
  }
}

/**
 * The only names Host Apply ever reads as secrets (ADR 0056, PRD #565 decision
 * "Implementation Decisions"). `DATABASE_URL` is deliberately absent — it is
 * loaded on the host from the selector store, never a GitHub secret. The public
 * secret-name table in `docs/deployment/CI_CD_AND_RELEASE_PROCESS.md` lists the
 * same eight names; keep both in sync by hand, there is no shared source yet.
 */
export const HOST_APPLY_SECRET_NAMES = Object.freeze([
  'SSH_HOST',
  'SSH_PORT',
  'SSH_USER',
  'SSH_PRIVATE_KEY',
  'APP_ROOT',
  'NODEVENV_ACTIVATE',
  'SELECTOR_APP_KEY',
  'API_ORIGIN',
]);

/** The on-host sequence, in the order the PRD pins as the contract. */
export const HOST_APPLY_STEP_ORDER = Object.freeze([
  'activate-nodevenv',
  'enter-app-root',
  'load-database-url',
  'npm-ci',
  'prisma-migrate-deploy',
  'prisma-generate',
  'restart',
  'migrate-status',
]);

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HostApplyRefusal(
      `${name} is required and must be a non-empty string`,
    );
  }
  return value;
}

/** Single-quotes a value for POSIX shell, escaping embedded single quotes. */
function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Builds the shell fragment that loads `DATABASE_URL` on the host for exactly
 * one app identity (`selectorAppKey`) from the Node.js selector store, and
 * refuses without printing the value if the identity or the key is missing.
 *
 * The lookup reads the identity's own entry by key (`data[key]`) — it never
 * iterates the store, so it cannot walk a sibling app even if the generated
 * script were somehow inspected. The URL only ever exists inside a `$(...)`
 * command substitution assigned straight to a shell variable; nothing in this
 * fragment echoes, prints, or logs it.
 *
 * `~/.cpanel/nodejsapps.json` is this engine's assumption about where the
 * cPanel Node.js Selector keeps an app's configured environment variables —
 * ADR 0056 deliberately does not pin the real path in the public tree. The
 * HITL operator checklist for the first live apply on each environment (#569)
 * must confirm this location and shape against the real host before trusting
 * it; a wrong assumption here fails closed (exit 4, refused) rather than
 * silently misparsing, but it would refuse a legitimate apply until fixed.
 */
export function buildSelectorLoadStep(selectorAppKey) {
  requireNonEmptyString(selectorAppKey, 'SELECTOR_APP_KEY');

  const lookup = [
    'const fs = require("fs");',
    'const path = require("path");',
    `const key = ${JSON.stringify(selectorAppKey)};`,
    'const file = path.join(process.env.HOME || "", ".cpanel", "nodejsapps.json");',
    'let data;',
    'try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { process.exit(4); }',
    'const hasKey = data != null && Object.prototype.hasOwnProperty.call(data, key);',
    'const entry = hasKey ? data[key] : undefined;',
    'const url = entry && entry.envvars ? entry.envvars.DATABASE_URL : undefined;',
    'if (!url) process.exit(4);',
    'process.stdout.write(url);',
  ].join(' ');

  return [
    `DATABASE_URL="$(node -e ${shQuote(lookup)})" || { echo "host-apply: refused - selector has no DATABASE_URL for the configured app identity" >&2; exit 1; }`,
    '[ -n "$DATABASE_URL" ] || { echo "host-apply: refused - selector returned an empty DATABASE_URL" >&2; exit 1; }',
    'export DATABASE_URL',
  ].join('\n');
}

/**
 * Builds the ordered on-host steps from secret values the caller already
 * resolved (from GitHub Environment secrets — this module never fetches
 * them). Throws `HostApplyRefusal` if any required secret is missing.
 */
export function buildHostApplySteps({
  nodevenvActivate,
  appRoot,
  selectorAppKey,
}) {
  requireNonEmptyString(nodevenvActivate, 'NODEVENV_ACTIVATE');
  requireNonEmptyString(appRoot, 'APP_ROOT');
  requireNonEmptyString(selectorAppKey, 'SELECTOR_APP_KEY');

  return [
    { id: 'activate-nodevenv', command: `source ${shQuote(nodevenvActivate)}` },
    { id: 'enter-app-root', command: `cd ${shQuote(appRoot)}` },
    { id: 'load-database-url', command: buildSelectorLoadStep(selectorAppKey) },
    { id: 'npm-ci', command: 'npm ci --omit=dev' },
    { id: 'prisma-migrate-deploy', command: 'npm run prisma:migrate:deploy' },
    { id: 'prisma-generate', command: 'npm run prisma:generate' },
    { id: 'restart', command: 'touch tmp/restart.txt' },
    { id: 'migrate-status', command: 'npm run prisma:migrate:status' },
  ];
}

/**
 * Renders steps into one POSIX script for a single SSH invocation.
 * `set -euo pipefail` is what makes this fail closed (ADR 0056): the first
 * failing step (a pending migration, a missing script) aborts everything
 * after it, so a bad `prisma migrate deploy` can never reach `restart`.
 */
export function renderHostApplyScript(steps) {
  return ['set -euo pipefail', ...steps.map((step) => step.command)].join('\n');
}

/** Convenience wrapper: secrets in, `{ steps, script }` out. */
export function buildHostApplyScript(secrets) {
  const steps = buildHostApplySteps(secrets);
  return { steps, script: renderHostApplyScript(steps) };
}

/**
 * Refuses an `APP_ROOT` that is unset, or that collides with the other
 * environment's pinned root (ADR 0056: a shared hosting account means an SSH
 * principal that can Host Apply Staging can reach Production's tree).
 * `counterpartAppRoot` is whatever pin the caller has for the *other*
 * environment; passing `undefined` (single-environment context) skips only
 * the collision check, never the unset check.
 */
export function assertAppRootGuard({
  environment,
  appRoot,
  counterpartAppRoot,
}) {
  if (environment !== 'staging' && environment !== 'production') {
    throw new HostApplyRefusal(
      `unknown Host Apply environment: ${JSON.stringify(environment)}`,
    );
  }

  requireNonEmptyString(appRoot, 'APP_ROOT');

  if (counterpartAppRoot && appRoot === counterpartAppRoot) {
    const other = environment === 'staging' ? 'Production' : 'Staging';
    throw new HostApplyRefusal(
      `APP_ROOT for ${environment} equals the ${other} pin - refusing to avoid crossing app roots`,
    );
  }

  return appRoot;
}

/**
 * Patterns a captured Host Apply log must never match. Issue #566 names two
 * shapes explicitly: a full connection string, and a bare `DATABASE_URL=`
 * assignment (the second catches an accidental `env | grep` even when no
 * connection string is present).
 */
const LOG_LEAK_RULES = Object.freeze([
  { id: 'database-url-assignment', pattern: /DATABASE_URL\s*=/ },
  {
    id: 'connection-string',
    pattern: /\b(postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?):\/\/\S+/i,
  },
]);

/** Every redaction violation in `logText`, one entry per matching line. */
export function findHostApplyLogLeaks(logText) {
  const lines = String(logText).split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    for (const rule of LOG_LEAK_RULES) {
      if (rule.pattern.test(line)) {
        findings.push({ line: index + 1, rule: rule.id, text: line });
      }
    }
  });

  return findings;
}

/** Throws `HostApplyRefusal` if `logText` leaks a secret; otherwise returns void. */
export function assertHostApplyLogClean(logText) {
  const findings = findHostApplyLogLeaks(logText);
  if (findings.length === 0) return;

  throw new HostApplyRefusal(
    `host apply log contains ${findings.length} redaction violation(s): ` +
      findings.map((f) => `line ${f.line} (${f.rule})`).join(', '),
  );
}

/**
 * The `npm run` scripts the deploy bundle must keep exposing so this engine's
 * `prisma-migrate-deploy` / `prisma-generate` / `migrate-status` steps have
 * something to call (produced by `tools/scripts/package-backend-api.mjs`).
 * `prisma:migrate:deploy` and `prisma:generate` are issue #566's named
 * acceptance criterion; `prisma:migrate:status` is included too because
 * `HOST_APPLY_STEP_ORDER`'s last step depends on it existing just as much —
 * an assertion that only covered the first two would pass while that step
 * silently had nothing to call.
 */
export const REQUIRED_PACKAGER_PRISMA_SCRIPTS = Object.freeze([
  'prisma:migrate:deploy',
  'prisma:generate',
  'prisma:migrate:status',
]);

/**
 * Which of `REQUIRED_PACKAGER_PRISMA_SCRIPTS` are missing from the packager's
 * source text. Reads source rather than executing the packager: running it
 * needs a real `dist/apps/backend` build and shells out to `npm install`,
 * which is exactly the live-host-shaped dependency this engine's tests avoid.
 */
export function findMissingPackagerPrismaScripts(packagerSource) {
  return REQUIRED_PACKAGER_PRISMA_SCRIPTS.filter(
    (name) => !packagerSource.includes(`'${name}':`),
  );
}
