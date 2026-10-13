/**
 * Tests for staging-web-deploy.mjs — the decisions behind Staging's web deploy
 * (issue #1138, ADR 0128). Every read of a host is a stub. The one CLI test that
 * reaches the real fetch names a reserved `.invalid` host, which never resolves.
 *
 * Run with: yarn staging-web:test
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BUNDLE_HTACCESS,
  PLAN_INSTALL_OWED,
  PLAN_RESTART,
  SCHEDULE_FAIL_UPLOADED_NOT_RUNNING,
  SCHEDULE_OUTCOMES,
  SCHEDULE_PROCEED,
  SCHEDULE_SKIP_NEWER,
  SCHEDULE_SKIP_SERVING,
  SERVICE_WORKER_CACHE_CONTROL,
  SERVICE_WORKER_CSP,
  StagingWebDeployRefusal,
  assertBundleKeepsHostHtaccess,
  decidePlan,
  decideSchedule,
  fetchUploadedState,
  findServiceWorkerHeaderProblems,
  hashDependencies,
  isSameSite,
  parseDeployState,
  planDeploy,
  planSchedule,
  probeDeploy,
  siteOf,
} from './staging-web-deploy.mjs';

const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'staging-web-deploy.mjs',
);

const WEB = 'https://staging.example.test';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);

const DEPS_1 = { next: '16.0.0', react: '19.0.0' };
const DEPS_2 = { next: '16.0.0', react: '19.0.0', sharp: '0.34.0' };
const HASH_1 = hashDependencies({ dependencies: DEPS_1 });
const HASH_2 = hashDependencies({ dependencies: DEPS_2 });

const html = (sha) => `<html><script>self.b="${sha}"</script></html>`;

const GOOD_SW_HEADERS = {
  'cache-control': SERVICE_WORKER_CACHE_CONTROL,
  'content-security-policy': SERVICE_WORKER_CSP,
};

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readRepo = (path) => readFileSync(join(REPO, path), 'utf8');

const response = (status, body = '', headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  text: async () => body,
});

/**
 * A host as the deploy sees it: what the process renders, what was uploaded,
 * and what `/sw.js` comes back with. `login` may be a function of the attempt
 * number, so a probe test can make the new build appear late.
 */
function host({ login = null, state = undefined, sw = GOOD_SW_HEADERS } = {}) {
  const calls = [];
  let loginAttempts = 0;
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/login') {
      loginAttempts += 1;
      const body = typeof login === 'function' ? login(loginAttempts) : login;
      if (body === 'throw') throw new Error('connect ECONNREFUSED');
      return body === null ? response(503) : response(200, body);
    }
    if (path === '/deploy-state.json') {
      if (state === undefined) return response(404, 'Not Found');
      return response(
        200,
        typeof state === 'string' ? state : JSON.stringify(state),
      );
    }
    if (path === '/sw.js') {
      return sw === null ? response(404) : response(200, '// sw', sw);
    }
    return response(404);
  };
  return { fetcher, calls };
}

/** A clock the probe advances by sleeping, so no test waits in real time. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
  };
}

// === Same site ===

test('subdomains of one domain are the same site', () => {
  assert.equal(
    isSameSite('https://staging.example.com', 'https://api.example.com'),
    true,
  );
  assert.equal(
    isSameSite('https://example.com', 'https://api.staging.example.com/api/v1'),
    true,
  );
});

test('identical hosts are the same site, whatever the port or case', () => {
  assert.equal(
    isSameSite('http://localhost:4200', 'http://localhost:3000'),
    true,
  );
  assert.equal(
    isSameSite('https://App.Example.com', 'https://app.example.com'),
    true,
  );
});

test('different parent domains are different sites', () => {
  assert.equal(
    isSameSite('https://staging.example.com', 'https://api.example.org'),
    false,
  );
  assert.equal(
    isSameSite('https://app.one.test', 'https://api.two.test'),
    false,
  );
});

test('a vercel.app address and a custom domain are different sites', () => {
  // The defect of #1138: the refresh cookie set by the API is never sent.
  assert.equal(
    isSameSite('https://myapp.vercel.app', 'https://api.example.com'),
    false,
  );
});

test('siteOf is the last two labels — a rule of thumb, and wrong for co.uk', () => {
  assert.equal(siteOf('https://a.b.example.com'), 'example.com');
  // Documented limitation, pinned so nobody mistakes it for the Public Suffix List.
  assert.equal(isSameSite('https://one.co.uk', 'https://two.co.uk'), true);
});

test('an origin that is not a URL is refused without echoing it', () => {
  assert.throws(
    () => isSameSite('not a url', 'https://api.example.com'),
    (err) =>
      err instanceof StagingWebDeployRefusal && !/not a url/.test(err.message),
  );
});

test('the CLI exits 1 on different sites and names the consequence, not the hosts', () => {
  const different = spawnSync(
    process.execPath,
    [CLI, 'same-site', 'https://myapp.vercel.app', 'https://api.example.com'],
    { encoding: 'utf8' },
  );
  assert.equal(different.status, 1);
  assert.match(different.stderr, /refresh cookie/);
  assert.doesNotMatch(different.stderr + different.stdout, /vercel|example/);

  const same = spawnSync(
    process.execPath,
    [CLI, 'same-site', 'https://web.example.com', 'https://api.example.com'],
    { encoding: 'utf8' },
  );
  assert.equal(same.status, 0, same.stderr);
});

// === Dependency hash and state ===

test('hashDependencies ignores key order and sees a version change', () => {
  assert.equal(
    hashDependencies({ dependencies: { react: '19.0.0', next: '16.0.0' } }),
    HASH_1,
  );
  assert.notEqual(
    hashDependencies({ dependencies: { ...DEPS_1, next: '16.0.1' } }),
    HASH_1,
  );
  assert.notEqual(HASH_1, HASH_2);
});

test('parseDeployState rejects anything this module did not write', () => {
  assert.equal(parseDeployState(null), null);
  assert.equal(parseDeployState({ sha: '', depsHash: HASH_1 }), null);
  assert.equal(parseDeployState({ sha: SHA_A, depsHash: 'nope' }), null);
  assert.deepEqual(parseDeployState({ sha: SHA_A, depsHash: HASH_1 }), {
    sha: SHA_A,
    depsHash: HASH_1,
    installedDepsHash: null,
  });
});

test('an HTML 404 page for the state file reads as no state', async () => {
  const { fetcher } = host({ state: '<html>Not Found</html>' });
  assert.equal(await fetchUploadedState(fetcher, WEB), null);
});

// === Plan ===

test('first deploy: no state on the host means an install is owed', async () => {
  const { fetcher } = host({ login: html('some-default-build-id') });

  const plan = await planDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_A,
    packageJson: { dependencies: DEPS_1 },
  });

  assert.equal(plan.action, PLAN_INSTALL_OWED);
  assert.deepEqual(plan.state, {
    sha: SHA_A,
    depsHash: HASH_1,
    installedDepsHash: null,
  });
});

test('unchanged dependencies with the uploaded build running: restart', async () => {
  const { fetcher } = host({
    login: html(SHA_A),
    state: { sha: SHA_A, depsHash: HASH_1, installedDepsHash: HASH_1 },
  });

  const plan = await planDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    packageJson: { dependencies: DEPS_1 },
  });

  assert.equal(plan.action, PLAN_RESTART);
  assert.deepEqual(plan.state, {
    sha: SHA_B,
    depsHash: HASH_1,
    installedDepsHash: HASH_1,
  });
});

test('changed dependencies: install owed, and the proven list is carried forward', async () => {
  const { fetcher } = host({
    login: html(SHA_A),
    state: { sha: SHA_A, depsHash: HASH_1, installedDepsHash: HASH_1 },
  });

  const plan = await planDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    packageJson: { dependencies: DEPS_2 },
  });

  assert.equal(plan.action, PLAN_INSTALL_OWED);
  assert.deepEqual(plan.state, {
    sha: SHA_B,
    depsHash: HASH_2,
    installedDepsHash: HASH_1,
  });
});

test('install still owed: a later commit does not promote an unproven list', async () => {
  // B was uploaded with new dependencies and nobody installed: A still runs.
  const { fetcher } = host({
    login: html(SHA_A),
    state: { sha: SHA_B, depsHash: HASH_2, installedDepsHash: HASH_1 },
  });

  const plan = await planDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_C,
    packageJson: { dependencies: DEPS_2 },
  });

  assert.equal(plan.action, PLAN_INSTALL_OWED);
  assert.equal(plan.state.installedDepsHash, HASH_1);
});

test('operator installed after an install-owed: the list is promoted and the next run restarts', async () => {
  // Same state file as above, but the operator ran NPM Install and Restart,
  // so the process now serves B — which proves B's dependencies are installed.
  const { fetcher } = host({
    login: html(SHA_B),
    state: { sha: SHA_B, depsHash: HASH_2, installedDepsHash: HASH_1 },
  });

  const plan = await planDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_C,
    packageJson: { dependencies: DEPS_2 },
  });

  assert.equal(plan.action, PLAN_RESTART);
  assert.deepEqual(plan.state, {
    sha: SHA_C,
    depsHash: HASH_2,
    installedDepsHash: HASH_2,
  });
});

test('an unreachable host falls back to the last proven list', () => {
  const uploadedState = {
    sha: SHA_A,
    depsHash: HASH_2,
    installedDepsHash: HASH_1,
  };
  assert.equal(
    decidePlan({
      sha: SHA_B,
      depsHash: HASH_1,
      runningHtml: null,
      uploadedState,
    }).action,
    PLAN_RESTART,
  );
  assert.equal(
    decidePlan({
      sha: SHA_B,
      depsHash: HASH_2,
      runningHtml: null,
      uploadedState,
    }).action,
    PLAN_INSTALL_OWED,
  );
});

test('plan refuses a commit that is not a full SHA before any request', async () => {
  const { fetcher, calls } = host();
  await assert.rejects(
    planDeploy({
      fetcher,
      webOrigin: WEB,
      sha: 'abc1234',
      packageJson: { dependencies: DEPS_1 },
    }),
    StagingWebDeployRefusal,
  );
  assert.deepEqual(calls, []);
});

// === Probe ===

test('probe passes once the running process serves the uploaded build', async () => {
  const { fetcher, calls } = host({
    login: (attempt) => (attempt < 3 ? html(SHA_A) : html(SHA_B)),
  });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    ...fakeClock(),
  });

  assert.deepEqual(result, { ok: true, attempts: 3 });
  assert.deepEqual(calls, ['/login', '/login', '/login', '/sw.js']);
});

test('probe survives a host that refuses connections while it restarts', async () => {
  const { fetcher } = host({
    login: (attempt) => (attempt === 1 ? 'throw' : html(SHA_B)),
  });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    ...fakeClock(),
  });

  assert.equal(result.ok, true);
});

test('probe times out when the old build keeps answering', async () => {
  const { fetcher, calls } = host({ login: html(SHA_A) });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    timeoutSeconds: 30,
    intervalSeconds: 10,
    ...fakeClock(),
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /\/login did not answer from build bbbbbbb/);
  assert.match(result.reason, /within 30s/);
  assert.doesNotMatch(result.reason, /example\.test/);
  // Never reaches the header check: an old build's headers prove nothing.
  assert.ok(!calls.includes('/sw.js'));
  assert.equal(calls.length, 4);
});

test('probe fails when /sw.js comes back without its headers', async () => {
  const { fetcher } = host({ login: html(SHA_B), sw: {} });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    ...fakeClock(),
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /\/sw\.js has no Cache-Control/);
  assert.match(result.reason, /\/sw\.js has no Content-Security-Policy/);
});

test('probe fails when /sw.js carries a permissive policy', async () => {
  // Present is not enough: this header exists and confines nothing.
  const { fetcher } = host({
    login: html(SHA_B),
    sw: { ...GOOD_SW_HEADERS, 'content-security-policy': 'default-src *' },
  });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    ...fakeClock(),
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /Content-Security-Policy is "default-src \*"/);
  assert.doesNotMatch(result.reason, /Cache-Control/);
});

test('probe fails when /sw.js is missing', async () => {
  const { fetcher } = host({ login: html(SHA_B), sw: null });

  const result = await probeDeploy({
    fetcher,
    webOrigin: WEB,
    sha: SHA_B,
    ...fakeClock(),
  });

  assert.deepEqual(result, { ok: false, reason: '/sw.js answered 404' });
});

test('service worker headers are compared exactly, but for spacing and case', () => {
  const problems = (headers) =>
    findServiceWorkerHeaderProblems(new Headers(headers));

  assert.deepEqual(problems(GOOD_SW_HEADERS), []);
  assert.deepEqual(
    problems({
      'cache-control': '  No-Cache,  no-store, must-revalidate ',
      'content-security-policy': "default-src 'self';  script-src 'self' ",
    }),
    [],
  );

  // Each of these contains no-store, or some policy, and is still wrong.
  assert.equal(
    problems({ ...GOOD_SW_HEADERS, 'cache-control': 'no-store' }).length,
    1,
  );
  assert.equal(
    problems({
      ...GOOD_SW_HEADERS,
      'cache-control': `${SERVICE_WORKER_CACHE_CONTROL}, public`,
    }).length,
    1,
  );
  assert.equal(
    problems({
      ...GOOD_SW_HEADERS,
      'content-security-policy': `${SERVICE_WORKER_CSP} 'unsafe-inline'`,
    }).length,
    1,
  );
  assert.equal(problems({ 'cache-control': 'public, max-age=3600' }).length, 2);
});

// === The three places the service worker headers are written ===

test('next.config.js sets exactly the expected service worker headers', () => {
  const config = readRepo('apps/myorganizer/next.config.js');
  const valueOf = (key) =>
    config.match(
      new RegExp(`key: '${key}',\\s*value:\\s*(?:'([^']*)'|"([^"]*)")`),
    );

  const cacheControl = valueOf('Cache-Control');
  const csp = valueOf('Content-Security-Policy');
  assert.equal(
    cacheControl?.[1] ?? cacheControl?.[2],
    SERVICE_WORKER_CACHE_CONTROL,
  );
  assert.equal(csp?.[1] ?? csp?.[2], SERVICE_WORKER_CSP);
});

test('the sw-headers snippet sets exactly the expected service worker headers, for sw.js only', () => {
  const snippet = readRepo('apps/myorganizer/deploy/sw-headers.htaccess');
  const directives = snippet
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.deepEqual(directives, [
    '<IfModule mod_headers.c>',
    '<Files "sw.js">',
    `Header set Cache-Control "${SERVICE_WORKER_CACHE_CONTROL}"`,
    `Header set Content-Security-Policy "${SERVICE_WORKER_CSP}"`,
    '</Files>',
    '</IfModule>',
  ]);
});

// === The host's own .htaccess is never overwritten ===

test('the tree has no apps/myorganizer/public/.htaccess', () => {
  assert.equal(
    existsSync(join(REPO, 'apps/myorganizer/public/.htaccess')),
    false,
    "the host's document root is this folder and holds the host's own .htaccess; shipping one overwrites it",
  );
});

test('a bundle that carries public/.htaccess is refused', () => {
  assert.throws(
    () =>
      assertBundleKeepsHostHtaccess([
        'server.js',
        'public/sw.js',
        BUNDLE_HTACCESS,
      ]),
    (err) =>
      err instanceof StagingWebDeployRefusal &&
      /overwrite/.test(err.message) &&
      /Nothing was uploaded/.test(err.message),
  );
  assert.throws(
    () => assertBundleKeepsHostHtaccess(['public\\.htaccess']),
    StagingWebDeployRefusal,
  );
});

test('a bundle without one passes', () => {
  assert.doesNotThrow(() =>
    assertBundleKeepsHostHtaccess(['server.js', 'public/sw.js']),
  );
  assert.doesNotThrow(() => assertBundleKeepsHostHtaccess([]));
});

test('the plan CLI refuses such a bundle before reading the host or writing state', (t) => {
  const bundle = mkdtempSync(join(tmpdir(), 'staging-web-bundle-'));
  t.after(() => rmSync(bundle, { recursive: true, force: true }));
  mkdirSync(join(bundle, 'public'));
  mkdirSync(join(bundle, '.next'));
  writeFileSync(join(bundle, 'package.json'), '{"dependencies":{}}');
  writeFileSync(join(bundle, '.next', 'BUILD_ID'), SHA_A);
  writeFileSync(join(bundle, 'public', '.htaccess'), '# ours');

  const result = spawnSync(
    process.execPath,
    [
      CLI,
      'plan',
      '--web-origin',
      'https://staging-web-deploy.invalid',
      '--sha',
      SHA_A,
      '--bundle',
      bundle,
    ],
    { encoding: 'utf8', env: { PATH: process.env.PATH } },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /refused - the bundle contains public\/\.htaccess/,
  );
  assert.equal(existsSync(join(bundle, 'public', 'deploy-state.json')), false);
  assert.equal(result.stdout, '');
});

// === What the probe stands on ===

test('the root layout stays force-dynamic, so /login comes from the running process', () => {
  // Without it Next.js prerenders /login at build time. The page would then be
  // read from disk, and the probe, the schedule and the plan would all report
  // the uploaded build as the running one.
  assert.match(
    readRepo('apps/myorganizer/src/app/layout.tsx'),
    /^export const dynamic = 'force-dynamic';$/m,
  );
});

// === Schedule ===

const schedule = (input) =>
  decideSchedule({
    greenSha: SHA_B,
    runningServesGreen: false,
    uploadedSha: null,
    greenIsAncestorOfUploaded: false,
    ...input,
  });

test('schedule proceeds when Staging holds nothing known', () => {
  assert.equal(schedule({}), SCHEDULE_PROCEED);
});

test('schedule proceeds when Staging holds an older commit', () => {
  assert.equal(schedule({ uploadedSha: SHA_A }), SCHEDULE_PROCEED);
});

test('schedule skips when the running process already serves the commit', () => {
  assert.equal(
    schedule({ runningServesGreen: true, uploadedSha: SHA_B }),
    SCHEDULE_SKIP_SERVING,
  );
  // Running wins over everything else that might also be true.
  assert.equal(
    schedule({
      runningServesGreen: true,
      uploadedSha: SHA_C,
      greenIsAncestorOfUploaded: true,
    }),
    SCHEDULE_SKIP_SERVING,
  );
});

test('schedule fails, uploading nothing, when the commit is uploaded but not running', () => {
  assert.equal(
    schedule({ uploadedSha: SHA_B }),
    SCHEDULE_FAIL_UPLOADED_NOT_RUNNING,
  );
});

test('schedule does not roll back a newer dispatched commit', () => {
  assert.equal(
    schedule({ uploadedSha: SHA_C, greenIsAncestorOfUploaded: true }),
    SCHEDULE_SKIP_NEWER,
  );
});

test('every schedule decision has an outcome, and only one of them fails the run', () => {
  const decisions = [
    SCHEDULE_PROCEED,
    SCHEDULE_SKIP_SERVING,
    SCHEDULE_SKIP_NEWER,
    SCHEDULE_FAIL_UPLOADED_NOT_RUNNING,
  ];
  assert.deepEqual(
    Object.keys(SCHEDULE_OUTCOMES).sort(),
    [...decisions].sort(),
  );
  assert.deepEqual(
    decisions.filter((d) => SCHEDULE_OUTCOMES[d].proceed),
    [SCHEDULE_PROCEED],
  );
  assert.deepEqual(
    decisions.filter((d) => SCHEDULE_OUTCOMES[d].failed),
    [SCHEDULE_FAIL_UPLOADED_NOT_RUNNING],
  );
  assert.match(
    SCHEDULE_OUTCOMES[SCHEDULE_FAIL_UPLOADED_NOT_RUNNING].summary,
    /Run NPM Install.*Restart.*dispatch/s,
  );
});

/** An `isAncestor` stub that records what it was asked. */
function ancestry(answer) {
  const asked = [];
  return {
    asked,
    isAncestor: (ancestor, descendant) => {
      asked.push([ancestor, descendant]);
      return answer;
    },
  };
}

const stateFor = (sha) => ({
  sha,
  depsHash: HASH_1,
  installedDepsHash: HASH_1,
});

test('planSchedule: running the green commit skips without asking git', async () => {
  const { fetcher } = host({ login: html(SHA_B), state: stateFor(SHA_B) });
  const git = ancestry(true);

  const decision = await planSchedule({
    fetcher,
    webOrigin: WEB,
    greenSha: SHA_B,
    isAncestor: git.isAncestor,
  });

  assert.equal(decision, SCHEDULE_SKIP_SERVING);
  assert.deepEqual(git.asked, []);
});

test('planSchedule: the green commit uploaded under an older running build fails', async () => {
  const { fetcher } = host({ login: html(SHA_A), state: stateFor(SHA_B) });
  const git = ancestry(true);

  const decision = await planSchedule({
    fetcher,
    webOrigin: WEB,
    greenSha: SHA_B,
    isAncestor: git.isAncestor,
  });

  assert.equal(decision, SCHEDULE_FAIL_UPLOADED_NOT_RUNNING);
  assert.deepEqual(git.asked, []);
});

test('planSchedule: a newer uploaded commit is asked of git as (green, uploaded)', async () => {
  const { fetcher } = host({ login: html(SHA_C), state: stateFor(SHA_C) });
  const git = ancestry(true);

  const decision = await planSchedule({
    fetcher,
    webOrigin: WEB,
    greenSha: SHA_B,
    isAncestor: git.isAncestor,
  });

  assert.equal(decision, SCHEDULE_SKIP_NEWER);
  assert.deepEqual(git.asked, [[SHA_B, SHA_C]]);
});

test('planSchedule: an uploaded commit git does not know, or an older one, proceeds', async () => {
  const { fetcher } = host({ login: html(SHA_A), state: stateFor(SHA_A) });

  const decision = await planSchedule({
    fetcher,
    webOrigin: WEB,
    greenSha: SHA_B,
    isAncestor: ancestry(false).isAncestor,
  });

  assert.equal(decision, SCHEDULE_PROCEED);
});

test('planSchedule: an unreachable, unset or malformed address proceeds and names no host', async () => {
  const down = host({ login: 'throw' });
  const git = ancestry(true);

  for (const webOrigin of [WEB, '', 'not a url']) {
    const decision = await planSchedule({
      fetcher: down.fetcher,
      webOrigin,
      greenSha: SHA_B,
      isAncestor: git.isAncestor,
    });
    assert.equal(decision, SCHEDULE_PROCEED);
  }
  assert.deepEqual(git.asked, []);
});

test('planSchedule refuses a commit that is not a full SHA', async () => {
  const { fetcher, calls } = host();
  await assert.rejects(
    planSchedule({
      fetcher,
      webOrigin: WEB,
      greenSha: 'main',
      isAncestor: () => true,
    }),
    StagingWebDeployRefusal,
  );
  assert.deepEqual(calls, []);
});

test('the schedule CLI proceeds against a host that does not resolve, printing no host', () => {
  const result = spawnSync(
    process.execPath,
    [
      CLI,
      'schedule',
      '--sha',
      SHA_B,
      '--web-origin',
      'https://staging-web-deploy.invalid',
    ],
    { encoding: 'utf8', env: { PATH: process.env.PATH } },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), SCHEDULE_PROCEED);
  assert.doesNotMatch(result.stdout + result.stderr, /\.invalid/);
});
