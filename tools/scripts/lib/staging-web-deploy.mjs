/**
 * Decisions behind Staging's web deploy (issue #1138, ADR 0128).
 *
 * The Staging web app runs on a host where nothing automatic may open a shell:
 * the bundle arrives by FTP, the app restarts when `tmp/restart.txt` changes,
 * and an operator runs "Run NPM Install" by hand. This module decides three
 * things for `deploy-staging.yml`, with every network read injected so the
 * decisions run under test without a host:
 *
 *   - whether the web address and the API address are on the same site;
 *   - whether the schedule should deploy at all, or would repeat or roll
 *     back what Staging already holds;
 *   - whether an upload may restart the app, or an install is owed first;
 *   - whether the build that answers is the build just uploaded.
 *
 * Two reads of the host mean different things, and the plan depends on the
 * difference. Files under the bundle's `public/` are served from disk, so
 * `/deploy-state.json` says what was last UPLOADED. The HTML of `/login` comes
 * from the Node process, so it says what is RUNNING. Neither needs a shell.
 * The second holds only while the root layout exports
 * `dynamic = 'force-dynamic'`: a prerendered `/login` would be read from disk
 * and say what was uploaded, not what is running.
 *
 * No function here puts an origin in a message: both addresses are GitHub
 * Environment secrets (ADR 0056), and a message names the path only.
 *
 * Run the tests with: yarn staging-web:test
 */
import { createHash } from 'node:crypto';

/** A page the Node process renders, so its HTML carries the running build id. */
export const RUNNING_BUILD_PATH = '/login';
/** A static file in the bundle's `public/`, so it reflects the last upload. */
export const DEPLOY_STATE_PATH = '/deploy-state.json';
export const SERVICE_WORKER_PATH = '/sw.js';

export const PLAN_RESTART = 'restart';
export const PLAN_INSTALL_OWED = 'install-owed';

/**
 * The two headers `/sw.js` must carry (ADR 0127), stated three times: here,
 * in `apps/myorganizer/next.config.js` for a host that renders through
 * Next.js, and in the snippet `apps/myorganizer/deploy/sw-headers.htaccess`,
 * which an operator appends once to the host's own `.htaccess` where
 * `public/` is served from disk. The test suite reads both files and fails
 * when either stops containing these exact values.
 */
export const SERVICE_WORKER_CACHE_CONTROL =
  'no-cache, no-store, must-revalidate';
export const SERVICE_WORKER_CSP = "default-src 'self'; script-src 'self'";

export const SCHEDULE_PROCEED = 'proceed';
export const SCHEDULE_SKIP_SERVING = 'skip-serving';
export const SCHEDULE_SKIP_NEWER = 'skip-newer';
export const SCHEDULE_FAIL_UPLOADED_NOT_RUNNING = 'fail-uploaded-not-running';

const COMMIT = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;

/** Refusal raised by a guard in this module. Never carries an origin. */
export class StagingWebDeployRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'StagingWebDeployRefusal';
  }
}

/**
 * The last two DNS labels of an origin's hostname.
 *
 * A rule of thumb, not the Public Suffix List: it is wrong for a suffix that
 * is itself two labels (`example.co.uk` and `other.co.uk` both read as
 * `co.uk`), and for a shared-hosting suffix such as `vercel.app`, where two
 * different projects read as one site. It is right for the case it guards — a
 * web app and an API on subdomains of one domain the operator owns.
 */
export function siteOf(origin, label = 'origin') {
  let hostname;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    throw new StagingWebDeployRefusal(`${label} is not a valid URL`);
  }
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length === 0) {
    throw new StagingWebDeployRefusal(`${label} has no hostname`);
  }
  return labels.slice(-2).join('.');
}

export function isSameSite(webOrigin, apiOrigin) {
  return (
    siteOf(webOrigin, 'the web origin') === siteOf(apiOrigin, 'the API origin')
  );
}

/**
 * Decides what a scheduled run does with the newest green `main` commit.
 *
 * The schedule may only move Staging forward, and only once per commit:
 *
 *   - the running process already serves the commit: nothing to do;
 *   - the commit is uploaded but not running (an install is owed, or a
 *     restart did not take): uploading it again fixes nothing, and a nameless
 *     scheduled re-upload of a commit a dispatch already uploaded and Host
 *     Applied would make the Cut guard refuse that commit — so the run fails
 *     and uploads nothing;
 *   - Staging holds a commit newer than the green one (a dispatch put it
 *     there): the schedule does not roll it back;
 *   - otherwise deploy.
 *
 * `greenIsAncestorOfUploaded` is git's answer, and false when git does not
 * know the uploaded commit: an unknown commit is not evidence of a newer one.
 *
 * @param {{
 *   greenSha: string,
 *   runningServesGreen: boolean,
 *   uploadedSha: string | null,
 *   greenIsAncestorOfUploaded: boolean,
 * }} input
 */
export function decideSchedule({
  greenSha,
  runningServesGreen,
  uploadedSha,
  greenIsAncestorOfUploaded,
}) {
  if (runningServesGreen) return SCHEDULE_SKIP_SERVING;
  if (uploadedSha === greenSha) return SCHEDULE_FAIL_UPLOADED_NOT_RUNNING;
  if (uploadedSha !== null && greenIsAncestorOfUploaded) {
    return SCHEDULE_SKIP_NEWER;
  }
  return SCHEDULE_PROCEED;
}

/** Whether a decision lets the later jobs run, and what the run's summary says. */
export const SCHEDULE_OUTCOMES = Object.freeze({
  [SCHEDULE_PROCEED]: { proceed: true, failed: false, summary: null },
  [SCHEDULE_SKIP_SERVING]: {
    proceed: false,
    failed: false,
    summary: 'Staging already serves that commit. Nothing was uploaded.',
  },
  [SCHEDULE_SKIP_NEWER]: {
    proceed: false,
    failed: false,
    summary:
      'Staging holds a newer commit (dispatched); the schedule does not roll it back. Nothing was uploaded.',
  },
  [SCHEDULE_FAIL_UPLOADED_NOT_RUNNING]: {
    proceed: false,
    failed: true,
    summary:
      'That commit is already uploaded to Staging, but the running web app is not serving it: an install is owed, or a restart did not take. ' +
      'In cPanel, open the Staging web app under **Setup Node.js App**, click **Run NPM Install**, then **Restart**; or dispatch `Deploy Staging`. ' +
      'Nothing was uploaded again.',
  },
});

/**
 * Gathers what `decideSchedule` needs and decides. An address that is unset,
 * malformed or unreachable reads as "nothing known", which proceeds: silence
 * is not proof that Staging holds anything. `isAncestor(a, b)` is injected and
 * is only asked when there is an uploaded commit other than the green one.
 */
export async function planSchedule({
  fetcher,
  webOrigin,
  greenSha,
  isAncestor,
}) {
  if (!COMMIT.test(greenSha)) {
    throw new StagingWebDeployRefusal('the commit is not a 40-character SHA');
  }

  let runningHtml = null;
  let uploadedState = null;
  try {
    siteOf(webOrigin, 'the web origin');
    [runningHtml, uploadedState] = await Promise.all([
      fetchRunningHtml(fetcher, webOrigin),
      fetchUploadedState(fetcher, webOrigin),
    ]);
  } catch {
    // Unset or malformed: treated as unreachable.
  }

  const uploadedSha = uploadedState?.sha ?? null;
  const runningServesGreen = (runningHtml ?? '').includes(greenSha);
  const greenIsAncestorOfUploaded =
    !runningServesGreen && uploadedSha !== null && uploadedSha !== greenSha
      ? Boolean(await isAncestor(greenSha, uploadedSha))
      : false;

  return decideSchedule({
    greenSha,
    runningServesGreen,
    uploadedSha,
    greenIsAncestorOfUploaded,
  });
}

/** Where a bundle would carry an `.htaccess` into the host's document root. */
export const BUNDLE_HTACCESS = 'public/.htaccess';

/**
 * Refuses a bundle that would overwrite the host's own `.htaccess`.
 *
 * The web app's document root on the host is the bundle's `public/` folder,
 * and the host keeps its own `.htaccess` there: the configuration that starts
 * the app. An upload replaces a file of the same name, so a bundle carrying
 * one takes the app down. `bundleFiles` is the bundle's file list, relative
 * to its root, however the caller gathered it.
 */
export function assertBundleKeepsHostHtaccess(bundleFiles) {
  const normalized = bundleFiles.map((file) => file.replaceAll('\\', '/'));
  if (normalized.includes(BUNDLE_HTACCESS)) {
    throw new StagingWebDeployRefusal(
      `the bundle contains ${BUNDLE_HTACCESS}. The host's document root is that folder and holds the host's own .htaccess; uploading this one would overwrite it and take the app down. ` +
        'Remove it from apps/myorganizer/public. Nothing was uploaded.',
    );
  }
}

/** sha256 over the bundle's `dependencies`, keys sorted so order never matters. */
export function hashDependencies(packageJson) {
  const dependencies = packageJson?.dependencies ?? {};
  const sorted = Object.keys(dependencies)
    .sort()
    .map((name) => [name, String(dependencies[name])]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/** A state file this module wrote, or null for anything else. */
export function parseDeployState(value) {
  if (value === null || typeof value !== 'object') return null;
  if (typeof value.sha !== 'string' || !COMMIT.test(value.sha)) return null;
  if (typeof value.depsHash !== 'string' || !HASH.test(value.depsHash)) {
    return null;
  }
  const installed = value.installedDepsHash;
  return {
    sha: value.sha,
    depsHash: value.depsHash,
    installedDepsHash:
      typeof installed === 'string' && HASH.test(installed) ? installed : null,
  };
}

/**
 * Decides whether this upload may restart the app.
 *
 * The host cannot be asked what is in its `node_modules`, so "installed" is
 * inferred: when the running process serves the build that was last uploaded,
 * that build's dependency list is proven installed (it could not have started
 * otherwise). When it serves an older build, the last list an earlier run
 * proved is carried forward unchanged. With no state at all, nothing is proven
 * and an install is owed — which is the first deploy.
 *
 * @param {{
 *   sha: string,
 *   depsHash: string,
 *   runningHtml: string | null,
 *   uploadedState: ReturnType<typeof parseDeployState>,
 * }} input
 */
export function decidePlan({ sha, depsHash, runningHtml, uploadedState }) {
  let installed = null;
  if (uploadedState) {
    installed = (runningHtml ?? '').includes(uploadedState.sha)
      ? uploadedState.depsHash
      : uploadedState.installedDepsHash;
  }

  return {
    action: installed === depsHash ? PLAN_RESTART : PLAN_INSTALL_OWED,
    state: { sha, depsHash, installedDepsHash: installed },
  };
}

const NO_CACHE = { 'cache-control': 'no-cache' };

async function get(fetcher, origin, path) {
  return fetcher(new URL(path, origin), { headers: NO_CACHE });
}

/** The running process's HTML, or null when the host does not answer with a page. */
export async function fetchRunningHtml(fetcher, webOrigin) {
  try {
    const response = await get(fetcher, webOrigin, RUNNING_BUILD_PATH);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

/** The last uploaded state, or null when there is none or it does not parse. */
export async function fetchUploadedState(fetcher, webOrigin) {
  try {
    const response = await get(fetcher, webOrigin, DEPLOY_STATE_PATH);
    if (!response.ok) return null;
    return parseDeployState(JSON.parse(await response.text()));
  } catch {
    return null;
  }
}

/** Refuses before any request, so a bad input never reads as "host is down". */
function assertDeployInputs(webOrigin, sha) {
  siteOf(webOrigin, 'the web origin');
  if (!COMMIT.test(sha)) {
    throw new StagingWebDeployRefusal('the commit is not a 40-character SHA');
  }
}

export async function planDeploy({ fetcher, webOrigin, sha, packageJson }) {
  assertDeployInputs(webOrigin, sha);
  const [runningHtml, uploadedState] = await Promise.all([
    fetchRunningHtml(fetcher, webOrigin),
    fetchUploadedState(fetcher, webOrigin),
  ]);
  return decidePlan({
    sha,
    depsHash: hashDependencies(packageJson),
    runningHtml,
    uploadedState,
  });
}

/**
 * What is wrong with the headers `/sw.js` came back with, as messages.
 *
 * The service worker is a file in `public/`, so on a host that serves that
 * folder from disk the `headers()` rule in `next.config.js` never runs and
 * a block in the host's own `.htaccess`, taken from the snippet, is what sets
 * these (ADR 0127). The values are compared
 * with the expected ones, not merely required to be present: a permissive
 * policy is a header too.
 */
export function findServiceWorkerHeaderProblems(headers) {
  const problems = [];
  for (const [name, expected] of [
    ['Cache-Control', SERVICE_WORKER_CACHE_CONTROL],
    ['Content-Security-Policy', SERVICE_WORKER_CSP],
  ]) {
    const actual = headers.get(name);
    if (actual === null) {
      problems.push(`${SERVICE_WORKER_PATH} has no ${name}`);
    } else if (normalizeHeader(actual) !== normalizeHeader(expected)) {
      problems.push(
        `${SERVICE_WORKER_PATH} ${name} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
      );
    }
  }
  return problems;
}

/**
 * Exact but for what a server may change without changing the meaning:
 * surrounding and repeated spaces, and letter case (directive names and CSP
 * keywords such as 'self' are case-insensitive). An added or missing directive
 * is a different value.
 */
const normalizeHeader = (value) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const realSleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Waits for the uploaded build to answer, then checks the service worker's
 * headers. Only the running process counts: a static file would say the build
 * is uploaded, which the FTP step already knows.
 *
 * @returns {Promise<{ ok: true, attempts: number } | { ok: false, reason: string }>}
 */
export async function probeDeploy({
  fetcher,
  webOrigin,
  sha,
  timeoutSeconds = 300,
  intervalSeconds = 10,
  sleep = realSleep,
  now = Date.now,
}) {
  assertDeployInputs(webOrigin, sha);

  const deadline = now() + timeoutSeconds * 1000;
  let attempts = 0;
  let live = false;
  for (;;) {
    attempts += 1;
    const html = await fetchRunningHtml(fetcher, webOrigin);
    if (html?.includes(sha)) {
      live = true;
      break;
    }
    if (now() + intervalSeconds * 1000 > deadline) break;
    await sleep(intervalSeconds * 1000);
  }

  if (!live) {
    return {
      ok: false,
      reason:
        `${RUNNING_BUILD_PATH} did not answer from build ${sha.slice(0, 7)} within ${timeoutSeconds}s ` +
        `(${attempts} attempt(s)). The bundle is uploaded but the running process is not serving it.`,
    };
  }

  let headers;
  try {
    const response = await get(fetcher, webOrigin, SERVICE_WORKER_PATH);
    if (!response.ok) {
      return {
        ok: false,
        reason: `${SERVICE_WORKER_PATH} answered ${response.status}`,
      };
    }
    headers = response.headers;
  } catch {
    return { ok: false, reason: `${SERVICE_WORKER_PATH} could not be fetched` };
  }

  const problems = findServiceWorkerHeaderProblems(headers);
  if (problems.length > 0) {
    return { ok: false, reason: problems.join('; ') };
  }
  return { ok: true, attempts };
}
