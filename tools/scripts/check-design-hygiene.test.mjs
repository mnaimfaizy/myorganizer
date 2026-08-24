import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CHECKER_SOURCE = join(SCRIPT_DIR, 'check-design-hygiene.mjs');
const SCAN_SOURCE = join(SCRIPT_DIR, 'lib', 'design-page-scan.mjs');
const SHARED_SCAN_SOURCE = join(SCRIPT_DIR, 'lib', 'source-scan.mjs');

const FONT_BLOCK =
  '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }';

function write(workspace, relativePath, content) {
  const file = join(workspace, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return relativePath;
}

/** A page that satisfies every rule, so each test can break exactly one thing. */
function housePage(title) {
  return [
    `<title>${title}</title>`,
    '<style>',
    FONT_BLOCK,
    ':root { --ink: #101010; }',
    '@media (prefers-color-scheme: dark) {',
    "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
    '}',
    ":root[data-theme='dark'] { --ink: #f0f0f0; }",
    '</style>',
    '<svg viewBox="0 0 10 10" role="img" aria-label="Diagram"></svg>',
    `<script type="application/json" id="${title}-manifest">{ "note": "x" }</script>`,
  ].join('\n');
}

// Mirrors ROSTER in check-design-hygiene.mjs. The fixture workspace writes a page
// for each entry, so a roster addition that stops here fails these tests with
// `page-missing` rather than anything to do with what the new page contains.
const ROSTER_PAGES = [
  'docs/agents/orchestration-map.html',
  'docs/deployment/release-pipeline.html',
  'docs/sandcastle/dispatch-map.html',
  'docs/sandcastle/gates.html',
  'docs/sandcastle/logs.html',
  'docs/sandcastle/resume.html',
  'docs/sandcastle/waves.html',
];

const LEGACY_PAGES = [
  'docs/agents/agent-journey.html',
  'docs/agents/skill-atlas.html',
  'docs/authentication/session-lifecycle.html',
  'docs/vault/trust-boundary.html',
];

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'design-hygiene-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  write(
    workspace,
    'tools/scripts/check-design-hygiene.mjs',
    readFileSync(CHECKER_SOURCE, 'utf8'),
  );
  write(
    workspace,
    'tools/scripts/lib/design-page-scan.mjs',
    readFileSync(SCAN_SOURCE, 'utf8'),
  );
  write(
    workspace,
    'tools/scripts/lib/source-scan.mjs',
    readFileSync(SHARED_SCAN_SOURCE, 'utf8'),
  );

  // The canonical font page is also a LEGACY entry, so it must exist either way.
  write(workspace, 'docs/vault/lifecycle.html', housePage('lifecycle'));
  for (const page of [...ROSTER_PAGES, ...LEGACY_PAGES]) {
    write(
      workspace,
      page,
      housePage(page.split('/').pop().replace('.html', '')),
    );
  }
  write(
    workspace,
    '.prettierignore',
    [...ROSTER_PAGES, ...LEGACY_PAGES, 'docs/vault/lifecycle.html'].join('\n'),
  );

  return workspace;
}

function run(workspace, ...args) {
  return spawnSync(
    process.execPath,
    [join(workspace, 'tools/scripts/check-design-hygiene.mjs'), ...args],
    { cwd: workspace, encoding: 'utf8' },
  );
}

test('a clean roster exits 0 and reports the page count', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, '--all');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Design hygiene: 0 error\(s\), 0 warning\(s\)/);
  for (const page of ROSTER_PAGES) assert.ok(result.stdout.includes(page));
});

test('a defect on a roster page exits 1 and names the file and rule', (t) => {
  const workspace = createWorkspace(t);
  write(
    workspace,
    'docs/sandcastle/gates.html',
    housePage('gates').replace(
      '<svg viewBox="0 0 10 10" role="img" aria-label="Diagram"></svg>',
      '<svg viewBox="0 0 10 10" role="img"><title>Gates</title></svg>',
    ),
  );
  const result = run(workspace, '--all');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /docs\/sandcastle\/gates\.html/);
  assert.match(result.stdout, /ERROR svg-title-tooltip/);
  assert.match(result.stdout, /Design hygiene: 1 error\(s\)/);
});

test('an unclassified page under docs/ is a finding under --all', (t) => {
  const workspace = createWorkspace(t);
  write(workspace, 'docs/newthing/overview.html', housePage('overview'));
  const result = run(workspace, '--all');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /docs\/newthing\/overview\.html/);
  assert.match(result.stdout, /ERROR unclassified-page/);
});

test('a legacy page is skipped rather than failed, with its reason', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, 'docs/agents/skill-atlas.html');
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /docs\/agents\/skill-atlas\.html\s+SKIPPED \(Carries no @font-face/,
  );
});

test('a roster page passed explicitly is checked', (t) => {
  const workspace = createWorkspace(t);
  write(workspace, '.prettierignore', '');
  const result = run(workspace, 'docs/sandcastle/waves.html');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ERROR prettier-ignore-missing/);
});

test('a windows-style path argument resolves to the same roster entry', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, 'docs\\sandcastle\\waves.html');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Design hygiene: 0 error\(s\), 0 warning\(s\)/);
});

test('--json emits a machine-readable report', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, '--json', 'docs/sandcastle/waves.html');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.errors, 0);
  assert.equal(report.results.length, 1);
  assert.deepEqual(report.results[0].findings, []);
});

test('a roster page missing from disk is a finding, not a crash', (t) => {
  const workspace = createWorkspace(t);
  rmSync(join(workspace, 'docs/sandcastle/logs.html'));
  const result = run(workspace, '--all');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ERROR page-missing/);
});

test('--print-font-block emits a block a new page can splice verbatim', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, '--print-font-block');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, FONT_BLOCK);

  // Splicing that output into a page is what makes font-block-drift pass.
  write(
    workspace,
    'docs/sandcastle/logs.html',
    housePage('logs').replace(FONT_BLOCK, result.stdout),
  );
  assert.equal(run(workspace, 'docs/sandcastle/logs.html').status, 0);
});

test('no arguments is a bad invocation', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('--all and --staged together is a bad invocation', (t) => {
  const workspace = createWorkspace(t);
  const result = run(workspace, '--all', '--staged');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /mutually exclusive/);
});

test('a missing canonical font page is a bad-run exit, not a page finding', (t) => {
  const workspace = createWorkspace(t);
  rmSync(join(workspace, 'docs/vault/lifecycle.html'));
  const result = run(workspace, '--all');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /canonical font page .* not found/);
});

// --- comment masking is scoped to code -----------------------------------------
//
// `/*` and `*/` are comment delimiters in a script and ordinary bytes in prose.
// Masking them document-wide made a glob in prose — `release/*`, `*.yml`,
// `docs/**/*.html` — open a comment that closed at the next real `*/` anywhere
// in the file, blanking everything between. Every rule reads that output, so the
// blanked region went unseen by all of them at once and the gate reported PASS.

/** Prose containing a glob, plus a later script carrying a real comment to close on. */
const withProseGlob = (page, markup = '') =>
  page.replace(
    '<svg viewBox="0 0 10 10" role="img" aria-label="Diagram"></svg>',
    [
      '<p>Production deploys run from release/* branches.</p>',
      markup ||
        '<svg viewBox="0 0 10 10" role="img" aria-label="Diagram"></svg>',
    ].join('\n'),
  ) + '\n<script>/* the pre-paint theme block */</script>';

test('a glob in prose does not hide a defect that follows it', (t) => {
  const workspace = createWorkspace(t);
  write(
    workspace,
    'docs/sandcastle/gates.html',
    withProseGlob(
      housePage('gates'),
      '<svg viewBox="0 0 10 10" role="img"><title>Gates</title></svg>',
    ),
  );

  const result = run(workspace, '--all');

  assert.equal(result.status, 1);
  assert.match(result.stdout, /ERROR svg-title-tooltip/);
});

test('a glob in prose does not hide the manifest that follows it', (t) => {
  const workspace = createWorkspace(t);
  // The real failure: the manifest sat between a `release/**` in an SVG label and
  // the next real `*/`, so the scanner never saw it and the page passed anyway.
  write(
    workspace,
    'docs/sandcastle/gates.html',
    withProseGlob(housePage('gates')),
  );

  const result = run(workspace, '--all');

  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /manifest-missing/);
});

test('a comment inside a script is still masked', (t) => {
  const workspace = createWorkspace(t);
  // The reason the masker exists: these pages explain their own rules in code
  // comments, and scanning them raw reports the explanation as the violation.
  write(
    workspace,
    'docs/sandcastle/gates.html',
    housePage('gates') +
      "\n<script>// localStorage.getItem('theme') runs guarded below\n/* localStorage.setItem too */</script>",
  );

  const result = run(workspace, '--all');

  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /unguarded-storage/);
});
