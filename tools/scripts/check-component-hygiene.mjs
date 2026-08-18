#!/usr/bin/env node

/**
 * Deterministic mechanical checks for React components.
 *
 * These are the ComponentReviewer checklist items that do not require judgment.
 * A model asked to confirm "displayName is set on every forwardRef component"
 * will say PASS at a glance and be wrong on the one sub-component that was
 * missed; a script counts. Running the shape rules here lets ComponentReviewer
 * spend its pass on the questions a script cannot answer — is the compound
 * split right, is this component doing too much, is the abstraction sound.
 *
 * Companion to check-test-hygiene.mjs; see docs/ui/GUIDELINES.md for the rules
 * this enforces and docs/adr/0014-component-pipeline-guardrails.md for why.
 *
 * Deliberately NOT checked here:
 *   - `any` usage — @typescript-eslint/no-explicit-any already owns it, honours
 *     inline disable comments, and this repo has four deliberate suppressions.
 *     Duplicating it here would report violations ESLint has already accepted.
 *   - 'use client' placement — Next.js inherits the client boundary through the
 *     import graph, so a child of a client component legitimately omits it. Not
 *     decidable from one file; ComponentReviewer judges it.
 *   - Composition pattern, concern mixing, abstraction quality, Radix-vs-custom
 *     — judgment, and the reason ComponentReviewer still reads the component.
 *
 * Usage:
 *   node tools/scripts/check-component-hygiene.mjs <file> [<file> ...]
 *   node tools/scripts/check-component-hygiene.mjs --json <file>
 *   node tools/scripts/check-component-hygiene.mjs --all
 *   node tools/scripts/check-component-hygiene.mjs --staged
 *   node tools/scripts/check-component-hygiene.mjs --all --max-warnings=0
 *
 * `--max-warnings=0` composes with any file-selection mode above, including
 * explicit file arguments — it is not restricted to `--all`/`--staged`.
 * ComponentBuilder and ComponentReviewer both invoke it this way on every
 * pass, so a warning that would fail pre-commit's staged strict check
 * (ADR 0014) surfaces as a required revision during review instead of only
 * at commit time.
 *
 * Exit codes: 0 = within budget, 1 = errors or exceeded warning budget,
 * 2 = bad invocation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

import {
  lineOf,
  maskNonCode,
  normalize,
  parenAfter,
  reportFindings,
} from './lib/source-scan.mjs';

const USAGE = `Usage:
  node tools/scripts/check-component-hygiene.mjs <file> [<file> ...] [--max-warnings=0]
  node tools/scripts/check-component-hygiene.mjs --json <file> [<file> ...] [--max-warnings=0]
  node tools/scripts/check-component-hygiene.mjs --all [--max-warnings=0]
  node tools/scripts/check-component-hygiene.mjs --staged [--max-warnings=0]

--max-warnings=0 composes with any mode above, including explicit files.

Runs the mechanical (non-judgment) ComponentReviewer checklist items against
React components in libs/web-ui/ (UI Primitives) and libs/web/pages/ (Feature
Components). Stories and test files are skipped. Judgment items — composition
pattern, concern mixing, abstraction quality — stay with ComponentReviewer.
`;

const BARREL = 'libs/web-ui/src/index.ts';
const MAX_JSX_LINES = 150;

// --- scope -------------------------------------------------------------------

function posix(file) {
  return path.normalize(file).replace(/\\/g, '/');
}

/** Returns 'primitive', 'feature', or null when the file is out of scope. */
function scopeOf(file) {
  const p = posix(file);
  if (/\.(stories|test|spec)\.tsx?$/.test(p)) return null;
  if (p.includes('libs/web-ui/src/lib/components/')) return 'primitive';
  if (/libs\/web\/pages\/[^/]+\/src\//.test(p)) return 'feature';
  return null;
}

// --- primitive checks --------------------------------------------------------

/**
 * Every forwardRef component needs displayName — it is what React DevTools and
 * error stacks show, and a compound component with six sub-components has six
 * chances to miss one.
 */
function checkDisplayName(code, raw, findings) {
  const re =
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\s*\.\s*)?forwardRef\s*</g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    const assigned = new RegExp(`\\b${name}\\s*\\.\\s*displayName\\s*=`).test(
      code,
    );
    if (!assigned) {
      findings.push({
        level: 'error',
        rule: 'forwardref-displayname',
        line: lineOf(raw, m.index),
        message: `'${name}' uses forwardRef but never sets ${name}.displayName. GUIDELINES §4.1 — required for DevTools and error stacks.`,
      });
    }
  }
}

/**
 * Naive template concatenation cannot resolve Tailwind conflicts, so a consumer
 * override silently loses to the base class. Only flags the case where the
 * consumer's own `className` is being interpolated — that is the one that
 * actually breaks overriding.
 */
function checkClassNameMerge(_code, raw, findings) {
  const re = /className\s*=\s*\{\s*`[^`]*\$\{\s*className\s*\}/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    findings.push({
      level: 'error',
      rule: 'classname-not-cn',
      line: lineOf(raw, m.index),
      message:
        'className is built by template concatenation with the incoming className. GUIDELINES §4.2 — use cn() so tailwind-merge can resolve conflicts.',
    });
  }
}

/**
 * A primitive that is not in the barrel cannot be imported by a feature
 * component through @myorganizer/web-ui, which is the only import path
 * GUIDELINES §1 permits.
 */
function checkBarrelExport(file, barrelSource, findings) {
  if (barrelSource === null) return;
  const p = posix(file);
  const match = p.match(
    /libs\/web-ui\/src\/(lib\/components\/[^/]+\/[^/]+)\.tsx$/,
  );
  if (!match) return;
  const specifier = `./${match[1]}`;
  if (!barrelSource.includes(specifier)) {
    findings.push({
      level: 'error',
      rule: 'missing-barrel-export',
      line: 1,
      message: `Not exported from ${BARREL}. GUIDELINES §4.6 — add "export * from '${specifier}';" in alphabetical order.`,
    });
  }
}

// --- feature checks ----------------------------------------------------------

/** Feature components must import primitives through the public entry point. */
function checkDeepImport(code, raw, findings) {
  const re = /\bfrom\s*(['"])([^'"]+)\1/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const spec = m[2];
    const deep =
      /web-ui\/src\//.test(spec) ||
      /web-vault-ui\/src\//.test(spec) ||
      /(^|\/)libs\/web-ui\//.test(spec);
    if (deep) {
      findings.push({
        level: 'error',
        rule: 'deep-import',
        line: lineOf(raw, m.index),
        message: `Imports '${spec}' directly instead of '@myorganizer/web-ui'. GUIDELINES §1 — deep imports bypass the barrel and break Nx module boundaries.`,
      });
    }
  }
}

/**
 * A handler recreated every render defeats memoization in the child and, for
 * children in a list, re-renders the whole list. GUIDELINES §5.6 makes this
 * unconditional, so the check only has to find handlers that are passed down
 * and not wrapped.
 */
function checkHandlerCallbacks(code, raw, findings) {
  const memoized = new Set();
  const memoRe =
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\s*\.\s*)?useCallback\s*\(/g;
  let m;
  while ((m = memoRe.exec(code)) !== null) memoized.add(m[1]);

  const declared = new Map();
  const declRe =
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=;]*)?=>/g;
  while ((m = declRe.exec(code)) !== null) {
    if (!declared.has(m[1])) declared.set(m[1], lineOf(raw, m.index));
  }
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnRe.exec(code)) !== null) {
    if (!declared.has(m[1])) declared.set(m[1], lineOf(raw, m.index));
  }

  const reported = new Set();
  const propRe = /\bon[A-Z]\w*\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
  while ((m = propRe.exec(code)) !== null) {
    const name = m[1];
    if (memoized.has(name)) continue;
    if (!declared.has(name)) continue; // a prop forwarded straight through
    if (reported.has(name)) continue;
    reported.add(name);
    findings.push({
      level: 'warn',
      rule: 'handler-not-memoized',
      line: lineOf(raw, m.index),
      message: `'${name}' is declared in this component (line ${declared.get(name)}) and passed as a prop, but is not wrapped in useCallback. GUIDELINES §5.6.`,
    });
  }
}

/** GUIDELINES §5.4 — props must be a named interface, not an inline type. */
function checkInlinePropsType(code, raw, findings) {
  const patterns = [
    // Destructured: `({ a }: { a: string }) => …` / `function X({ a }: { a: string }) {`
    /\}\s*:\s*\{[^{}]*\}\s*\)\s*(?::[^={]*)?\s*(?:=>|\{)/g,
    // Whole-object: `(props: { a: string })`
    /\(\s*props\s*:\s*\{[^{}]*\}\s*\)/g,
  ];
  const seen = new Set();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const line = lineOf(raw, m.index);
      if (seen.has(line)) continue;
      seen.add(line);
      findings.push({
        level: 'warn',
        rule: 'inline-props-type',
        line,
        message:
          'Props are annotated with an inline object type. GUIDELINES §5.4 — declare a named interface.',
      });
    }
  }
}

// --- checks that apply to both scopes ----------------------------------------

const LEAKY_SETUP =
  /\b(addEventListener|setInterval|setTimeout|requestAnimationFrame|subscribe|new\s+(?:ResizeObserver|MutationObserver|IntersectionObserver|WebSocket|AbortController|EventSource))\b/;

/**
 * A subscription or timer created in an effect without a teardown keeps firing
 * after unmount, against a component that no longer exists.
 */
function checkEffectCleanup(code, raw, findings) {
  const re = /\b(?:React\s*\.\s*)?useEffect\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const body = parenAfter(code, m.index + 'useEffect'.length - 1);
    if (!body) continue;
    const setup = body.match(LEAKY_SETUP);
    if (!setup) continue;
    if (/\breturn\s*(?:\(\s*\)|\w+\s*=>|\(\s*\)\s*=>|function)/.test(body)) {
      continue;
    }
    findings.push({
      level: 'error',
      rule: 'effect-missing-cleanup',
      line: lineOf(raw, m.index),
      message: `useEffect calls ${setup[1]} but returns no cleanup function. It keeps running after unmount.`,
    });
  }
}

const GENERIC_NAMES = new Set([
  'Section',
  'Panel',
  'Container',
  'Wrapper',
  'Content',
  'Item',
]);

/** GUIDELINES §6 — a name that describes nothing cannot be found later. */
function checkGenericName(file, code, raw, findings) {
  const base = path.basename(posix(file)).replace(/\.tsx?$/, '');
  if (GENERIC_NAMES.has(base)) {
    findings.push({
      level: 'warn',
      rule: 'generic-name',
      line: 1,
      message: `'${base}' is a generic component name. GUIDELINES §6 — name it for the section or action it represents.`,
    });
  }
}

/**
 * GUIDELINES §2 lists "exceeds ~150 lines of JSX" as the primary split signal.
 * Measured on the largest returned expression rather than the whole file so
 * that hooks, schemas, and helpers above the return do not inflate it.
 */
function checkJsxSize(code, raw, findings) {
  const re = /\breturn\s*\(/g;
  let m;
  let largest = null;
  while ((m = re.exec(code)) !== null) {
    const block = parenAfter(code, m.index);
    if (!block) continue;
    const lines = block.split('\n').length;
    if (!largest || lines > largest.lines) {
      largest = { lines, index: m.index };
    }
  }
  if (largest && largest.lines > MAX_JSX_LINES) {
    findings.push({
      level: 'warn',
      rule: 'oversized-jsx',
      line: lineOf(raw, largest.index),
      message: `Returned JSX spans ${largest.lines} lines (limit ~${MAX_JSX_LINES}). GUIDELINES §2 — extract a card, dialog, list row, or section into its own file.`,
    });
  }
}

// --- driver ------------------------------------------------------------------

async function inspect(file, scope, barrelSource) {
  const rawFile = await fs.readFile(file, 'utf8');
  const raw = normalize(rawFile);
  const code = maskNonCode(raw);
  const findings = [];

  checkEffectCleanup(code, raw, findings);
  checkGenericName(file, code, raw, findings);
  checkJsxSize(code, raw, findings);

  if (scope === 'primitive') {
    checkDisplayName(code, raw, findings);
    checkClassNameMerge(code, raw, findings);
    checkBarrelExport(file, barrelSource, findings);
  } else {
    checkDeepImport(code, raw, findings);
    checkHandlerCallbacks(code, raw, findings);
    checkInlinePropsType(code, raw, findings);
  }

  findings.sort((a, b) => a.line - b.line);
  return findings;
}

async function collectAll() {
  const roots = ['libs/web-ui/src/lib/components', 'libs/web/pages'];
  const out = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        await walk(full);
      } else if (entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  for (const root of roots) await walk(root);
  return out.sort();
}

function collectStaged() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-status', '--diff-filter=ACDMRT', '-z'],
    { cwd: root, encoding: 'utf8' },
  );
  process.chdir(root);

  const records = output.split('\0');
  const files = [];
  for (let index = 0; index < records.length; ) {
    const status = records[index++];
    if (!status) continue;

    const source = records[index++];
    if (!source) break;
    if (status.startsWith('R') || status.startsWith('C')) {
      const destination = records[index++];
      if (destination && scopeOf(destination)) files.push(destination);
    } else if (status !== 'D' && scopeOf(source)) {
      files.push(source);
    }
  }
  return files.sort();
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }

  const json = argv.includes('--json');
  const all = argv.includes('--all');
  const staged = argv.includes('--staged');
  const strictWarnings = argv.includes('--max-warnings=0');
  const validFlags = new Set([
    '--json',
    '--all',
    '--staged',
    '--max-warnings=0',
  ]);
  const unknownFlags = argv.filter(
    (argument) => argument.startsWith('--') && !validFlags.has(argument),
  );
  const explicitFiles = argv.filter((argument) => !argument.startsWith('--'));
  if (
    unknownFlags.length ||
    (all && staged) ||
    ((all || staged) && explicitFiles.length)
  ) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  let files = explicitFiles;

  if (all) files = await collectAll();
  if (staged) files = collectStaged();
  if (!files.length) {
    if (staged) {
      if (json) {
        process.stdout.write(
          `${JSON.stringify({ errors: 0, warnings: 0, results: [] }, null, 2)}\n`,
        );
      } else {
        process.stdout.write('No staged component files to check.\n');
      }
      return;
    }
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  let barrelSource = null;
  try {
    barrelSource = await fs.readFile(BARREL, 'utf8');
  } catch {
    // Barrel unreadable (wrong cwd, partial checkout) — skip that rule rather
    // than accuse every primitive of being unexported.
    barrelSource = null;
  }

  const results = [];
  let errors = 0;
  let warnings = 0;

  for (const file of files) {
    const scope = scopeOf(file);
    if (!scope) {
      results.push({
        file,
        skipped: 'not a UI Primitive or Feature Component',
        findings: [],
      });
      continue;
    }
    let findings;
    try {
      findings = await inspect(file, scope, barrelSource);
    } catch (error) {
      findings = [
        {
          level: 'error',
          rule: 'unreadable',
          line: 1,
          message: error?.message ?? String(error),
        },
      ];
    }
    errors += findings.filter((f) => f.level === 'error').length;
    warnings += findings.filter((f) => f.level === 'warn').length;
    results.push({ file, scope, findings });
  }

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ errors, warnings, results }, null, 2)}\n`,
    );
  } else {
    reportFindings(results, 'Component hygiene');
  }

  process.exitCode = errors > 0 || (strictWarnings && warnings > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
