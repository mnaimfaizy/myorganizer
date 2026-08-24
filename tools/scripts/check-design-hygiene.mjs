#!/usr/bin/env node

/**
 * Deterministic mechanical checks for House Explainer Pages — the self-contained
 * HTML artifacts the Designer sub-agent produces (`.github/agents/designer.agent.md`).
 *
 * Companion to check-test-hygiene.mjs and check-component-hygiene.mjs. The rules
 * live in tools/scripts/lib/design-page-scan.mjs, which is pure; this file reads
 * the filesystem facts those rules compare against and decides what is in scope.
 *
 * Scope is an explicit roster, not a glob. `docs/**` holds three lineages of HTML
 * page and only one of them is this convention: the Claude Design canvas exports
 * carry a bundled runtime with CDN fallback strings, and two pages predate the
 * three-state theme block. Globbing would fail them all on day one and teach
 * everyone to pass --no-verify. Every page under docs/ is therefore either in
 * ROSTER or in LEGACY with a written reason, and a page in neither is a finding
 * — so a new page cannot escape the gate by being new (ADR 0043).
 *
 * Usage:
 *   node tools/scripts/check-design-hygiene.mjs <file> [<file> ...]
 *   node tools/scripts/check-design-hygiene.mjs --json <file>
 *   node tools/scripts/check-design-hygiene.mjs --all
 *   node tools/scripts/check-design-hygiene.mjs --staged
 *   node tools/scripts/check-design-hygiene.mjs --print-font-block
 *
 * Exit codes: 0 = clean, 1 = findings, 2 = bad invocation.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  fontBlock,
  fontBlockHash,
  scanDesignPage,
} from './lib/design-page-scan.mjs';
import { reportFindings } from './lib/source-scan.mjs';

const USAGE = `Usage:
  node tools/scripts/check-design-hygiene.mjs <file> [<file> ...]
  node tools/scripts/check-design-hygiene.mjs --json <file> [<file> ...]
  node tools/scripts/check-design-hygiene.mjs --all
  node tools/scripts/check-design-hygiene.mjs --staged
  node tools/scripts/check-design-hygiene.mjs --print-font-block

Runs the mechanical House Explainer Page rules over the pages in ROSTER.
Judgment — is the hero the right hero, is the prose true — stays with review.

--print-font-block writes the canonical @font-face block to stdout so a new page
can splice it verbatim. Retyping or re-encoding it is what font-block-drift catches.
`;

/** Pages authored to the house convention. Adding one here is how it gets gated. */
const ROSTER = [
  'docs/agents/orchestration-map.html',
  'docs/deployment/release-pipeline.html',
  'docs/sandcastle/dispatch-map.html',
  'docs/sandcastle/gates.html',
  'docs/sandcastle/logs.html',
  'docs/sandcastle/resume.html',
  'docs/sandcastle/waves.html',
];

/**
 * Pages under docs/ that are deliberately not gated, each with the reason. An
 * entry here is a decision someone made rather than a gap nobody saw; retrofitting
 * one is its own change, not a prerequisite for gating the pages that already comply.
 */
const LEGACY = {
  'docs/agents/agent-journey.html':
    'Claude Design canvas export. Its bundled dc-runtime carries CDN fallback URLs as strings, which the self-containment rule cannot distinguish from a real load.',
  'docs/agents/skill-atlas.html':
    'Carries no @font-face block; its typography falls back to system stacks. Predates the canonical block.',
  'docs/authentication/session-lifecycle.html':
    'Carries its own @font-face block rather than the canonical one, defines dark tokens under an unguarded @media, and is absent from .prettierignore.',
  'docs/vault/lifecycle.html':
    'Canvas export, and the source of the canonical @font-face block. Defines dark tokens only under [data-theme=dark], with no prefers-color-scheme state.',
  'docs/vault/trust-boundary.html':
    'Same theme shape as lifecycle.html — predates the three-state convention.',
};

/**
 * The page every sibling splices its @font-face block from. Named here rather than
 * pinned as a literal hash so the comparison stays a fact about two files, and so
 * the slicing convention has exactly one implementation (design-page-scan.mjs).
 */
const CANONICAL_FONT_PAGE = 'docs/vault/lifecycle.html';

const DOCS_DIR = 'docs';

function posix(file) {
  return path.normalize(file).split(path.sep).join('/');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const printFontBlock = args.includes('--print-font-block');
  const json = args.includes('--json');
  const all = args.includes('--all');
  const staged = args.includes('--staged');
  const files = args.filter((a) => !a.startsWith('--'));

  if (printFontBlock) return { printFontBlock };
  if (all && staged)
    throw new Error('--all and --staged are mutually exclusive.');
  if (!all && !staged && files.length === 0) throw new Error(USAGE);
  if ((all || staged) && files.length > 0) {
    throw new Error('--all and --staged take no file arguments.');
  }
  return { printFontBlock, json, all, staged, files };
}

function stagedHtmlFiles() {
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRT'],
    { encoding: 'utf8' },
  );
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.endsWith('.html'));
}

function htmlPagesUnderDocs() {
  const out = [];
  (function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith('.html')) out.push(posix(p));
    }
  })(DOCS_DIR);
  return out.sort();
}

/**
 * .prettierignore membership. Matches the exact path or a directory prefix, which
 * is the only shape this file uses for HTML pages.
 */
function prettierIgnoreMatcher() {
  if (!existsSync('.prettierignore')) return () => false;
  const patterns = readFileSync('.prettierignore', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => (l.startsWith('/') ? l.slice(1) : l));
  return (file) =>
    patterns.some((p) => file === p || (p.endsWith('/') && file.startsWith(p)));
}

// --- run ---------------------------------------------------------------------

let options;
try {
  options = parseArgs(process.argv);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

if (!existsSync(CANONICAL_FONT_PAGE)) {
  console.error(
    `design-hygiene: canonical font page ${CANONICAL_FONT_PAGE} not found — cannot compare @font-face blocks.`,
  );
  process.exit(2);
}
const canonicalSource = readFileSync(CANONICAL_FONT_PAGE, 'utf8');
const canonicalFontHash = fontBlockHash(canonicalSource);
if (canonicalFontHash === null) {
  console.error(
    `design-hygiene: ${CANONICAL_FONT_PAGE} carries no @font-face block — the canonical block moved.`,
  );
  process.exit(2);
}

if (options.printFontBlock) {
  process.stdout.write(fontBlock(canonicalSource));
  process.exit(0);
}

const isPrettierIgnored = prettierIgnoreMatcher();
const results = [];

// A page under docs/ that is in neither list is unclassified: nobody decided
// whether it follows the convention, which is how the convention stops spreading.
if (options.all) {
  for (const page of htmlPagesUnderDocs()) {
    if (ROSTER.includes(page) || page in LEGACY) continue;
    results.push({
      file: page,
      findings: [
        {
          level: 'error',
          rule: 'unclassified-page',
          line: 1,
          message:
            'Not in ROSTER and not in LEGACY. Add it to ROSTER if it follows the House Explainer Page convention, or to LEGACY with the reason it does not (tools/scripts/check-design-hygiene.mjs).',
        },
      ],
    });
  }
}

const selected = options.all
  ? ROSTER
  : (options.staged ? stagedHtmlFiles() : options.files).map(posix);

for (const file of selected) {
  if (!ROSTER.includes(file)) {
    results.push({
      file,
      skipped: LEGACY[file] ?? 'not a House Explainer Page',
      findings: [],
    });
    continue;
  }
  if (!existsSync(file)) {
    results.push({
      file,
      findings: [
        {
          level: 'error',
          rule: 'page-missing',
          line: 1,
          message: 'Listed in ROSTER but not present on disk.',
        },
      ],
    });
    continue;
  }

  const source = readFileSync(file, 'utf8');
  const findings = scanDesignPage({
    file,
    source,
    canonicalFontHash,
    pageFontHash: fontBlockHash(source),
    prettierIgnored: isPrettierIgnored(file),
    adrLinkExists: (resolved) => existsSync(resolved),
  }).map((finding) => ({ level: 'error', ...finding }));
  results.push({ file, findings });
}

const errors = results.reduce((n, r) => n + r.findings.length, 0);

if (options.json) {
  process.stdout.write(`${JSON.stringify({ errors, results }, null, 2)}\n`);
} else {
  reportFindings(results, 'Design hygiene');
}

process.exit(errors > 0 ? 1 : 0);
