#!/usr/bin/env node
// Asserts that the authentication diagrams still describe the auth the code implements.
//
//   node tools/scripts/check-auth-pages.mjs
//   node tools/scripts/check-auth-pages.mjs --extractors   # verify extractors without the page
//
// The page embeds a manifest of the constants it asserts. This diffs that manifest against the
// values in source, so a TTL change, a renamed storage key, or a reordered router mount breaks
// the build instead of leaving a confidently wrong auth reference in docs/.
//
// Unlike the vault constants, almost nothing here is an exported `const` — TTLs are inline
// literals passed to generateToken, the cookie name is a string at the call site, and the
// mount order is a property of two statements in main.ts. Each value therefore gets a named
// extractor rather than a shared `const NAME =` regex. `--extractors` runs them all against
// source and prints what they resolved, which is how you check one after editing it.
//
// Exit 0 = in sync. Exit 1 = drift (rebuild or fix the page). Exit 2 = the check could not run.
import { readFileSync, existsSync } from 'node:fs';

const PAGES = [
  ['docs/authentication/session-lifecycle.html', 'auth-session-manifest'],
];

const fail = (msg) => {
  console.error(`auth-pages: ${msg}`);
  process.exit(2);
};

const fileCache = new Map();
const read = (path) => {
  if (!fileCache.has(path)) {
    if (!existsSync(path)) fail(`${path} not found`);
    fileCache.set(path, readFileSync(path, 'utf8'));
  }
  return fileCache.get(path);
};

const num = (raw) => Number(String(raw).replace(/_/g, ''));

/** Pulls a single capture group out of one file, failing loudly rather than returning undefined. */
const capture = (path, pattern, label) => {
  const match = read(path).match(pattern);
  if (!match) fail(`could not read ${label} from ${path}`);
  return match[1];
};

const TOKEN_LIFETIMES = 'apps/backend/src/helpers/tokenLifetimes.ts';
const COOKIE_HELPER = 'apps/backend/src/helpers/cookieHelper.ts';
const STORAGE_ADAPTER = 'libs/auth/src/lib/auth-session-storage-adapter.ts';
const AUTH_ROUTES = 'apps/backend/src/routes/auth.ts';
const MAIN = 'apps/backend/src/main.ts';

// Access and refresh lifetimes are derived in the source from a single number, so they are
// derived the same way here. Reading the rendered `'10m'` is not possible without evaluating
// the template literal, and hard-coding it would defeat the point of the guard.
const accessTtlMinutes = () =>
  num(
    capture(
      TOKEN_LIFETIMES,
      /const ACCESS_TOKEN_TTL_MINUTES\s*=\s*([\d_]+)/,
      'ACCESS_TOKEN_TTL_MINUTES',
    ),
  );

const refreshTtlDays = () =>
  num(
    capture(
      TOKEN_LIFETIMES,
      /export const REFRESH_TOKEN_TTL_DAYS\s*=\s*([\d_]+)/,
      'REFRESH_TOKEN_TTL_DAYS',
    ),
  );

/** The single-use email tokens are still plain literals, so they are read directly. */
const literalTtl = (name) =>
  capture(
    TOKEN_LIFETIMES,
    new RegExp(`export const ${name}\\s*=\\s*'([^']+)'`),
    name,
  );

const EXTRACTORS = {
  'tokens.accessTokenTtl': () => `${accessTtlMinutes()}m`,
  'tokens.refreshTokenTtl': () => `${refreshTtlDays()}d`,
  'tokens.verifyTokenTtl': () => literalTtl('VERIFY_TOKEN_TTL'),
  'tokens.resetTokenTtl': () => literalTtl('RESET_TOKEN_TTL'),

  'tokens.accessTokenExpiresInMs': () => accessTtlMinutes() * 60_000,

  'cookie.refreshCookieName': () =>
    capture(AUTH_ROUTES, /\.cookie\('([^']+)'/, 'refresh cookie name'),

  // The cookie no longer carries its own number — it derives from the refresh token's
  // lifetime. Asserting that derivation is what stops the two drifting apart again, so a
  // cookieHelper that reverts to a literal fails here rather than passing on a stale match.
  'cookie.refreshCookieDays': () => {
    const source = read(COOKIE_HELPER);
    if (!/getDate\(\)\s*\+\s*REFRESH_TOKEN_TTL_DAYS/.test(source)) {
      fail(
        `${COOKIE_HELPER} no longer derives its expiry from REFRESH_TOKEN_TTL_DAYS`,
      );
    }
    return refreshTtlDays();
  },

  'hashing.bcryptSaltRounds': () =>
    num(
      capture(
        'apps/backend/src/services/UserService.ts',
        /SaltRounds\s*=\s*(\d+)/,
        'bcrypt salt rounds',
      ),
    ),

  'clientStorage.accessTokenStorageKey': () =>
    capture(
      STORAGE_ADAPTER,
      /const ACCESS_TOKEN_KEY\s*=\s*'([^']+)'/,
      'ACCESS_TOKEN_KEY',
    ),
  'clientStorage.userStorageKey': () =>
    capture(STORAGE_ADAPTER, /const USER_KEY\s*=\s*'([^']+)'/, 'USER_KEY'),
  'clientStorage.tokenStorageModeKey': () =>
    capture(
      STORAGE_ADAPTER,
      /const TOKEN_STORAGE_KEY\s*=\s*'([^']+)'/,
      'TOKEN_STORAGE_KEY',
    ),

  'rateLimit.globalRateLimitDefaultWindowMs': () =>
    num(
      capture(
        'apps/backend/src/middleware/globalRateLimit.ts',
        /RATE_LIMIT_WINDOW_MS,\s*([\d_]+)/,
        'default rate limit window',
      ),
    ),
  'rateLimit.globalRateLimitDefaultMax': () =>
    num(
      capture(
        'apps/backend/src/middleware/globalRateLimit.ts',
        /RATE_LIMIT_MAX,\s*([\d_]+)/,
        'default rate limit max',
      ),
    ),

  authErrorCodes: () => {
    const body = capture(
      'libs/auth/src/lib/auth-session-types.ts',
      /export type AuthErrorCode =([\s\S]*?);/,
      'AuthErrorCode union',
    );
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  },

  adminAuditActions: () => {
    const body = capture(
      'apps/backend/src/prisma/schema/user.prisma',
      /enum AdminAuditAction\s*\{([\s\S]*?)\}/,
      'AdminAuditAction enum',
    );
    return body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  },

  // The whole page describes the router that actually serves /auth/*. Express is
  // first-match-wins, so if RegisterRoutes ever precedes the hand-written router the tsoa
  // AuthController starts handling requests and every divergence the page documents inverts.
  'routerPrecedence.authRouterBeforeTsoaRoutes': () => {
    const source = read(MAIN);
    const mount = source.search(/api\.use\(\s*'\/auth',\s*authRouter\s*\)/);
    const tsoa = source.search(/RegisterRoutes\(\s*api\s*\)/);
    if (mount === -1) fail(`could not find the /auth router mount in ${MAIN}`);
    if (tsoa === -1) fail(`could not find the RegisterRoutes call in ${MAIN}`);
    return mount < tsoa;
  },
};

// Sets, not sequences: the page may order codes by the sequence a reader meets them.
const UNORDERED = new Set(['authErrorCodes', 'adminAuditActions']);

const dig = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const sameValue = (path, expected, claimed) => {
  if (Array.isArray(expected)) {
    if (!Array.isArray(claimed) || expected.length !== claimed.length)
      return false;
    if (!UNORDERED.has(path)) return expected.every((v, i) => v === claimed[i]);
    const a = [...expected].sort();
    const b = [...claimed].sort();
    return a.every((v, i) => v === b[i]);
  }
  return expected === claimed;
};

const show = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

if (process.argv.includes('--extractors')) {
  for (const [path, extract] of Object.entries(EXTRACTORS)) {
    console.log(`  ${path.padEnd(46)} ${show(extract())}`);
  }
  console.log(
    `auth-pages: ${Object.keys(EXTRACTORS).length} extractors resolved against source`,
  );
  process.exit(0);
}

const findings = [];
let asserted = 0;

for (const [page, manifestId] of PAGES) {
  if (!existsSync(page)) fail(`${page} not found — build it first`);

  const html = readFileSync(page, 'utf8');
  const block = html.match(
    new RegExp(
      `<script type="application/json" id="${manifestId}">([\\s\\S]*?)</script>`,
    ),
  );
  if (!block)
    fail(`no #${manifestId} block in ${page} — rebuild it from the export`);

  let manifest;
  try {
    manifest = JSON.parse(block[1]);
  } catch (err) {
    fail(`#${manifestId} is not valid JSON: ${err.message}`);
  }

  let declared = 0;
  for (const [path, extract] of Object.entries(EXTRACTORS)) {
    const claimed = dig(manifest, path);
    if (claimed === undefined) continue;
    declared += 1;

    const expected = extract();
    if (!sameValue(path, expected, claimed)) {
      findings.push(
        `${page} → ${path}: page says ${show(claimed)}, source says ${show(expected)}`,
      );
    }
  }

  if (declared === 0)
    fail(`#${manifestId} declared none of the known constants`);
  asserted += declared;
}

if (findings.length) {
  console.error('auth-pages: the diagrams no longer match the code\n');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    '\nRebuild the page from its export, or fix the value it asserts.',
  );
  process.exit(1);
}

console.log(`auth-pages: ${asserted} assertions in sync`);
