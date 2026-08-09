#!/usr/bin/env node

/**
 * Deterministic mechanical checks for Jest test files.
 *
 * These are the TestReviewer checklist items that do not require judgment.
 * ADR 0004 defines TestReviewer as a static gate with "no judgment required";
 * running these here makes that literally true instead of asking a model to
 * eyeball import order. TestReviewer runs this and reports the output.
 *
 * Usage:
 *   node tools/scripts/check-test-hygiene.mjs <file> [<file> ...]
 *   node tools/scripts/check-test-hygiene.mjs --json <file>
 *
 * Exit codes: 0 = no errors, 1 = at least one error, 2 = bad invocation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const USAGE = `Usage:
  node tools/scripts/check-test-hygiene.mjs <file> [<file> ...]
  node tools/scripts/check-test-hygiene.mjs --json <file> [<file> ...]

Runs the mechanical (non-judgment) TestReviewer checklist items against Jest
test files. E2E specs under apps/myorganizer-e2e are skipped — they have their
own rules in .github/skills/playwright-e2e-workflow/references/e2e-patterns.md.
`;

/**
 * Blanks out line comments, block comments, and string/template literals so
 * pattern matching does not fire on prose. Positions are preserved so line
 * numbers stay accurate.
 */
function maskNonCode(source) {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  let state = 'code';
  let quote = '';

  const blank = (idx) => {
    if (out[idx] !== '\n') out[idx] = ' ';
  };

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        blank(i);
        blank(i + 1);
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        blank(i);
        blank(i + 1);
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        state = 'string';
        quote = ch;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (ch === '\n') state = 'code';
      else blank(i);
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (ch === '*' && next === '/') {
        blank(i);
        blank(i + 1);
        state = 'code';
        i += 2;
        continue;
      }
      blank(i);
      i += 1;
      continue;
    }

    // state === 'string'
    if (ch === '\\') {
      blank(i);
      blank(i + 1);
      i += 2;
      continue;
    }
    if (ch === quote) {
      state = 'code';
      quote = '';
      i += 1;
      continue;
    }
    blank(i);
    i += 1;
  }

  return out.join('');
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/** Returns the source slice of a balanced-brace block starting at `from`. */
function blockAfter(code, from) {
  const open = code.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return code.slice(open);
}

// --- individual checks -------------------------------------------------------

/**
 * The Nx trap is specific: a static import of a WORKSPACE library is what the
 * boundary lint sees. `jest.mock()` after a relative import is ordinary Jest and
 * is hoisted correctly, so only workspace imports are considered here.
 */
function checkMockOrdering(code, raw, findings) {
  // Positions come from the masked source (so comments never match); the module
  // specifier is read back from raw, because masking blanks string contents.
  const specifierAt = (index, pattern) => {
    const slice = raw.slice(index, index + 300);
    const found = slice.match(pattern);
    return found ? found[2] : null;
  };

  let firstWorkspaceImport = null;
  const importRe = /^[ \t]*import\s[^;]*?from\s*['"]/gm;
  let imp;
  while ((imp = importRe.exec(code)) !== null) {
    const spec = specifierAt(
      imp.index,
      /import\s[^;]*?from\s*(['"])([^'"]+)\1/,
    );
    if (spec?.startsWith('@myorganizer/')) {
      firstWorkspaceImport = { index: imp.index, spec };
      break;
    }
  }
  if (!firstWorkspaceImport) return;
  const firstLine = lineOf(raw, firstWorkspaceImport.index);

  const mockRe = /^[ \t]*jest\s*\.\s*mock\s*\(\s*['"]/gm;
  let m;
  while ((m = mockRe.exec(code)) !== null) {
    if (m.index <= firstWorkspaceImport.index) continue;
    const spec = specifierAt(m.index, /mock\s*\(\s*(['"])([^'"]+)\1/);
    if (!spec?.startsWith('@myorganizer/')) continue;
    findings.push({
      level: 'error',
      rule: 'jest-mock-before-imports',
      line: lineOf(raw, m.index),
      message: `jest.mock('${spec}') appears after the workspace import of '${firstWorkspaceImport.spec}' on line ${firstLine}. Nx flags that static import as a boundary violation at lint time; move every jest.mock() of a @myorganizer/* library above all @myorganizer/* imports, including 'import type'.`,
    });
  }
}

function checkBeforeAllMocks(code, raw, findings) {
  const re = /\bbeforeAll\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const body = blockAfter(code, m.index);
    const hit = body.match(
      /\b(mockReset|mockClear|mockRestore|mockResolvedValue|mockRejectedValue|mockReturnValue|mockImplementation|clearAllMocks|resetAllMocks|jest\s*\.\s*fn)\b/,
    );
    if (hit) {
      findings.push({
        level: 'error',
        rule: 'no-mock-setup-in-beforeAll',
        line: lineOf(raw, m.index),
        message: `beforeAll() configures mocks (${hit[1]}). Mocks retain state between tests; move this into beforeEach().`,
      });
    }
  }
}

/**
 * Only top-level (column 0) describes are considered. A nested
 * describe('error handling') under two different parents is legitimate; two
 * top-level blocks with the same title means a suite was appended twice.
 */
function checkDuplicateDescribes(code, raw, findings) {
  const seen = new Map();
  const re = /^describe\s*\(\s*(['"`])/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    // Title text was masked out, so recover it from the raw source.
    const rawSlice = raw.slice(m.index, m.index + 400);
    const titleMatch = rawSlice.match(/describe\s*\(\s*(['"`])([\s\S]*?)\1/);
    if (!titleMatch) continue;
    const title = titleMatch[2];
    const line = lineOf(raw, m.index);
    if (seen.has(title)) {
      findings.push({
        level: 'error',
        rule: 'no-duplicate-describe',
        line,
        message: `Duplicate describe('${title}') — first defined at line ${seen.get(title)}. This usually means a regenerated suite was appended instead of replacing the original.`,
      });
    } else {
      seen.set(title, line);
    }
  }
}

/**
 * Only module-scope (column 0) declarations. An indented `const x = (...)`
 * inside two different describe/beforeEach blocks is a scoped local, not a
 * duplicated helper.
 */
function checkDuplicateHelpers(code, raw, findings) {
  const seen = new Map();
  const re =
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const name = m[1] || m[2];
    const line = lineOf(raw, m.index);
    if (seen.has(name)) {
      findings.push({
        level: 'error',
        rule: 'no-duplicate-helper',
        line,
        message: `Helper '${name}' is declared twice — first at line ${seen.get(name)}.`,
      });
    } else {
      seen.set(name, line);
    }
  }
}

/**
 * A queue only exists when several *Once() calls stack up inside one test. Two
 * calls in two different `it()` blocks are independent one-shot overrides, so
 * hits are grouped per test block rather than per file.
 */
function checkMockReturnValueOnce(code, raw, findings) {
  const testRe = /\b(?:it|test)\s*(?:\.\s*\w+\s*)?\(/g;
  let t;
  while ((t = testRe.exec(code)) !== null) {
    const body = blockAfter(code, t.index);
    if (!body) continue;
    const offset = code.indexOf(body, t.index);
    const onceRe =
      /\bmock(?:ReturnValue|ResolvedValue|RejectedValue)Once\s*\(/g;
    const hits = [];
    let m;
    while ((m = onceRe.exec(body)) !== null) {
      hits.push(lineOf(raw, offset + m.index));
    }
    if (hits.length >= 2) {
      findings.push({
        level: 'error',
        rule: 'no-once-queues',
        line: hits[0],
        message: `${hits.length} *Once() calls stack up inside one test (lines ${hits.join(', ')}). Queue order breaks under async or concurrent calls — use an order-independent mockImplementation().`,
      });
    }
  }
}

function checkUnusedMockCasts(code, raw, findings) {
  const re =
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*\bas\s+(?:unknown\s+as\s+)?jest\s*\.\s*(?:Mock|Mocked)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    const uses = code.match(new RegExp(`\\b${name}\\b`, 'g')) ?? [];
    if (uses.length <= 1) {
      findings.push({
        level: 'error',
        rule: 'no-unused-mock-cast',
        line: lineOf(raw, m.index),
        message: `'${name}' is cast to jest.Mock but never used. Delete it — it will also trip no-unused-vars.`,
      });
    }
  }
}

function checkVacuousAssertions(code, raw, findings) {
  const total = (code.match(/\bexpect\s*\(/g) ?? []).length;
  if (total === 0) {
    findings.push({
      level: 'error',
      rule: 'no-assertions',
      line: 1,
      message: 'No expect() calls found in this test file.',
    });
    return;
  }
  const re = /\.\s*(toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined)\s*\(/g;
  const hits = [];
  let m;
  while ((m = re.exec(code)) !== null) hits.push(lineOf(raw, m.index));
  if (hits.length && hits.length / total > 0.3) {
    findings.push({
      level: 'warn',
      rule: 'weak-assertions',
      line: hits[0],
      message: `${hits.length} of ${total} assertions are vacuous (toBeTruthy/toBeDefined/…), lines ${hits.slice(0, 8).join(', ')}${hits.length > 8 ? ', …' : ''}. Prefer toBe/toEqual/toHaveBeenCalledWith.`,
    });
  }
}

const CHECKS = [
  checkMockOrdering,
  checkBeforeAllMocks,
  checkDuplicateDescribes,
  checkDuplicateHelpers,
  checkMockReturnValueOnce,
  checkUnusedMockCasts,
  checkVacuousAssertions,
];

async function inspect(file) {
  const raw = await fs.readFile(file, 'utf8');
  const code = maskNonCode(raw.replace(/\r\n/g, '\n'));
  const findings = [];
  for (const check of CHECKS) check(code, raw.replace(/\r\n/g, '\n'), findings);
  findings.sort((a, b) => a.line - b.line);
  return findings;
}

function isE2E(file) {
  return path
    .normalize(file)
    .replace(/\\/g, '/')
    .includes('apps/myorganizer-e2e/');
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    process.exitCode = argv.length ? 0 : 2;
    return;
  }

  const json = argv.includes('--json');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  const results = [];
  let errors = 0;
  let warnings = 0;

  for (const file of files) {
    if (isE2E(file)) {
      results.push({ file, skipped: 'e2e', findings: [] });
      continue;
    }
    let findings;
    try {
      findings = await inspect(file);
    } catch (error) {
      results.push({
        file,
        findings: [
          {
            level: 'error',
            rule: 'unreadable',
            line: 1,
            message: error?.message ?? String(error),
          },
        ],
      });
      errors += 1;
      continue;
    }
    errors += findings.filter((f) => f.level === 'error').length;
    warnings += findings.filter((f) => f.level === 'warn').length;
    results.push({ file, findings });
  }

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ errors, warnings, results }, null, 2)}\n`,
    );
  } else {
    for (const result of results) {
      if (result.skipped) {
        console.log(
          `\n${result.file}\n  SKIPPED (E2E spec — structural rules live in the Playwright skill)`,
        );
        continue;
      }
      console.log(`\n${result.file}`);
      if (!result.findings.length) {
        console.log('  PASS — no mechanical issues');
        continue;
      }
      for (const f of result.findings) {
        const tag = f.level === 'error' ? 'ERROR' : 'WARN ';
        console.log(
          `  ${tag} ${f.rule} (line ${f.line})\n        ${f.message}`,
        );
      }
    }
    console.log(
      `\nMechanical hygiene: ${errors} error(s), ${warnings} warning(s)`,
    );
  }

  process.exitCode = errors > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
