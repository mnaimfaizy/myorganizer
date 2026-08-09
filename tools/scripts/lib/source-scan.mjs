/**
 * Shared lexical helpers for the mechanical hygiene scripts.
 *
 * These scripts deliberately do not parse TypeScript. A real parser would pull
 * a compiler dependency into a pre-commit path for rules that are all shape
 * checks, and it would still not answer the judgment questions the agents keep.
 * Masking comments and string literals gets pattern matching close enough to be
 * trustworthy, provided every rule matches on masked source and reads any text
 * it needs back out of the raw source at the same index.
 *
 * Consumers: check-test-hygiene.mjs, check-component-hygiene.mjs
 */

/**
 * Blanks out line comments, block comments, and string/template literals so
 * pattern matching does not fire on prose. Positions are preserved so line
 * numbers stay accurate.
 */
export function maskNonCode(source) {
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

/** 1-indexed line number of a character offset. */
export function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/** Returns the source slice of a balanced-brace block starting at `from`. */
export function blockAfter(code, from) {
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

/** Returns the source slice of a balanced-paren group starting at `from`. */
export function parenAfter(code, from) {
  const open = code.indexOf('(', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return code.slice(open);
}

/** Normalizes CRLF so offsets and line numbers agree across platforms. */
export function normalize(source) {
  return source.replace(/\r\n/g, '\n');
}

/** Renders findings as text; returns the error/warning tally. */
export function reportFindings(results, label) {
  let errors = 0;
  let warnings = 0;
  for (const result of results) {
    if (result.skipped) {
      console.log(`\n${result.file}\n  SKIPPED (${result.skipped})`);
      continue;
    }
    console.log(`\n${result.file}`);
    if (!result.findings.length) {
      console.log('  PASS — no mechanical issues');
      continue;
    }
    for (const f of result.findings) {
      if (f.level === 'error') errors += 1;
      else warnings += 1;
      const tag = f.level === 'error' ? 'ERROR' : 'WARN ';
      console.log(`  ${tag} ${f.rule} (line ${f.line})\n        ${f.message}`);
    }
  }
  console.log(`\n${label}: ${errors} error(s), ${warnings} warning(s)`);
  return { errors, warnings };
}
