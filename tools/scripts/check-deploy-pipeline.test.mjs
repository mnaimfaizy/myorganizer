// Contract for check-deploy-pipeline.mjs.
//
// The fixture is a copy of the real files rather than a hand-written miniature:
// the checker's whole job is to read this repo's actual workflow shapes, and a
// fixture that drifts from them would pass while the checker no longer reads
// anything. Each negative case copies the real tree and then breaks one fact.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
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

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, 'check-deploy-pipeline.mjs');
const REPO = resolve(HERE, '..', '..');

const PAGE = 'docs/deployment/release-pipeline.html';
const STAGING = '.github/workflows/deploy-staging.yml';
const PRODUCTION = '.github/workflows/deploy-production.yml';

const FIXTURE_FILES = [
  PAGE,
  STAGING,
  PRODUCTION,
  '.github/workflows/ci.yml',
  '.github/workflows/dispatch-production-deploy.yml',
  '.github/workflows/publish-github-release.yml',
  'package.json',
  'tools/scripts/release.mjs',
];

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'deploy-pipeline-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  for (const file of FIXTURE_FILES) {
    const target = join(workspace, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(REPO, file), target);
  }
  return workspace;
}

const readFixture = (workspace, file) =>
  readFileSync(join(workspace, file), 'utf8');

const writeFixture = (workspace, file, content) =>
  writeFileSync(join(workspace, file), content);

/** Replaces one occurrence, asserting it was there — a no-op edit would fake a pass. */
function edit(workspace, file, from, to) {
  const before = readFixture(workspace, file);
  assert.ok(before.includes(from), `fixture no longer contains: ${from}`);
  writeFixture(workspace, file, before.replace(from, to));
}

/** Replaces the LAST occurrence — the deploy workflows do most things twice. */
function editLast(workspace, file, from, to) {
  const before = readFixture(workspace, file);
  const at = before.lastIndexOf(from);
  assert.notEqual(at, -1, `fixture no longer contains: ${from}`);
  writeFixture(
    workspace,
    file,
    before.slice(0, at) + to + before.slice(at + from.length),
  );
}

function runChecker(workspace, extraArgs = []) {
  return spawnSync(process.execPath, [CHECKER, workspace, ...extraArgs], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

/** Rewrites one key inside the page's embedded manifest. */
function editManifest(workspace, mutate) {
  const page = readFixture(workspace, PAGE);
  const pattern =
    /(<script type="application\/json" id="release-pipeline-manifest">)([\s\S]*?)(<\/script>)/;
  const match = page.match(pattern);
  assert.ok(match, 'fixture page has no manifest block');

  const manifest = JSON.parse(match[2]);
  mutate(manifest);
  writeFixture(
    workspace,
    PAGE,
    page.replace(pattern, `$1${JSON.stringify(manifest, null, 2)}$3`),
  );
}

test('passes when the page matches the workflows', (t) => {
  const result = runChecker(createWorkspace(t));

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /assertions in sync/);
});

test('--print resolves every extractor without reading the page', (t) => {
  const workspace = createWorkspace(t);
  rmSync(join(workspace, PAGE));

  const result = runChecker(workspace, ['--print']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /productionApprovalGatedJobs/);
});

test('fails when a pinned version on the page drifts from source', (t) => {
  const workspace = createWorkspace(t);
  editManifest(workspace, (m) => {
    m.stagingVercelCliVersion = '49.0.0';
  });

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /stagingVercelCliVersion/);
  assert.match(result.stderr, /50\.1\.1/);
});

test('fails when a deploy job loses its production environment', (t) => {
  const workspace = createWorkspace(t);
  // The approval gate is the page's hero and lives in one line of YAML. Removing
  // it from deploy-frontend leaves every other line of the workflow unchanged.
  editLast(workspace, PRODUCTION, '    environment: production\n', '');

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /productionApprovalGatedJobs/);
});

test('fails when the production frontend stops going to cPanel', (t) => {
  const workspace = createWorkspace(t);
  // Both deploy jobs call the FTP action; the frontend's is the second, so a
  // first-occurrence replace would edit the backend and prove nothing.
  editLast(
    workspace,
    PRODUCTION,
    'uses: samkirkland/ftp-deploy-action',
    'run: vercel deploy --prod #',
  );

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /productionFrontendTarget/);
});

test('fails when staging and production disagree on a value stated once', (t) => {
  const workspace = createWorkspace(t);
  edit(workspace, STAGING, 'timeout: 300000', 'timeout: 120000');

  const result = runChecker(workspace);

  // A value the page states once cannot describe two different numbers, so this
  // is a hard stop rather than a drift finding.
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a single value/);
});

test('fails when the page asserts a key no extractor reads', (t) => {
  const workspace = createWorkspace(t);
  editManifest(workspace, (m) => {
    m.productionSmokeTestUrl = 'https://example.invalid';
  });

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /productionSmokeTestUrl/);
  assert.match(result.stderr, /no extractor/);
});

test('fails when the page drops a key the checker knows about', (t) => {
  const workspace = createWorkspace(t);
  editManifest(workspace, (m) => {
    delete m.productionRefGuardPattern;
  });

  const result = runChecker(workspace);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /productionRefGuardPattern.*missing/s);
});

test('reads manifest values containing /* without masking them away', (t) => {
  const workspace = createWorkspace(t);

  const result = runChecker(workspace);

  // productionRefGuardPattern is `refs/heads/release/*` and the note names
  // `.github/workflows/*.yml`. Masking `/* … */` document-wide is what blinded
  // the design-hygiene gate to this very block, so this checker must not.
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFixture(workspace, PAGE), /refs\/heads\/release\/\*/);
});
