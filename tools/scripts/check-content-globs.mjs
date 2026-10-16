#!/usr/bin/env node
// Fails a Storybook `stories` glob or a Tailwind `content` glob that matches
// zero files (issue #898).
//
//   node tools/scripts/check-content-globs.mjs [--print]
//
// Both tools treat a glob that matches nothing as an empty answer, not an
// error. A stories glob left pointing at a moved library makes its stories
// vanish from Storybook, and Chromatic runs with `--exit-zero-on-changes`, so
// the job reports them as removed and still passes. A content glob that
// matches nothing makes Tailwind drop every class in the files it missed —
// the silent failure ADR 0065 records for the groceries pages (#632). Moving
// web libraries under `libs/web/` (#165) rewrote exactly these globs.
//
// Direction asserted: every glob a config declares matches at least one file.
// The offending glob is reported with the config that declares it.
//
// Directions deliberately omitted:
//
//   * The reverse — every story file is reached by some stories glob — is not
//     asserted. A glob that matches one file out of the forty it should have
//     passes. This gate catches a glob that went dead, which is what a move or
//     a typo does, not a glob that is merely too narrow.
//   * Negated content globs (`!…`) are skipped: a negation that excludes
//     nothing loses no content.
//   * Tailwind v4 `@source` directives in CSS are not read. No stylesheet in
//     this tree declares one; every source path reaches Tailwind through the
//     `content` array of a `tailwind.config.*` pulled in by `@config`.
//
// Why `yarn tailwind:classes:check` does not already cover content globs: it
// scans its own hard-coded source list (`SOURCES` in check-tailwind-classes.mjs)
// and never reads a config's `content` array, so a dead content glob passes it.
//
// Globs resolve relative to the config file's directory. Storybook resolves
// `stories` that way; Tailwind v4 resolves a `@config` file's `content` that
// way too, which is what both configs here rely on (`../../libs/**`).
//
// Configs are found by walking `apps/` and `libs/`: any `.storybook/main.*`
// and any `tailwind.config.*`, so a new Storybook or Tailwind setup is checked
// without editing this file.
//
// Exit 0 = every glob matches. Exit 1 = at least one glob matches no file.
// Exit 2 = the check could not run (no configs found, or a config's globs
// could not be read).
import { readdirSync, readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative } from 'node:path';

const ROOTS = ['apps', 'libs'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.nx', 'coverage']);
const STORYBOOK_MAIN = /^main\.(ts|js|mjs|cjs)$/;
const TAILWIND_CONFIG = /^tailwind\.config\.(js|cjs)$/;

/** Every `.storybook/main.*` and `tailwind.config.*` under the roots. */
export function findConfigs(cwd) {
  const storybook = [];
  const tailwind = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path);
      } else if (
        STORYBOOK_MAIN.test(entry.name) &&
        basename(dir) === '.storybook'
      ) {
        storybook.push(path);
      } else if (TAILWIND_CONFIG.test(entry.name)) {
        tailwind.push(path);
      }
    }
  };
  for (const root of ROOTS) walk(join(cwd, root));
  return { storybook: storybook.sort(), tailwind: tailwind.sort() };
}

// `source` with its comments removed and its string literals kept. A regex
// cannot do this: a stories glob such as `../src/lib/**/*.mdx` contains `/**/`,
// which is a complete block comment to anything that does not track strings.
// (Written as line comments for the same reason.)
export function stripComments(source) {
  let out = '';
  let quote = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      out += c;
      if (c === '\\') out += source[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
    } else {
      if (c === "'" || c === '"' || c === '`') quote = c;
      out += c;
    }
  }
  return out;
}

/**
 * The string globs in a Storybook main file's `stories` array. The file is
 * TypeScript, so it is read as text rather than imported. Throws when the
 * array is missing, empty, or holds anything other than string literals —
 * an entry this reader cannot see is an entry this gate cannot check.
 */
export function storiesGlobs(source) {
  const withoutComments = stripComments(source);
  const match = /\bstories\s*:\s*\[([\s\S]*?)\]/.exec(withoutComments);
  if (!match) throw new Error('no `stories: [...]` array found');
  const body = match[1];
  const literal = /(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;
  const globs = [...body.matchAll(literal)].map((m) => m[2]);
  const leftover = body.replace(literal, '').replace(/[\s,]/g, '');
  if (leftover) {
    throw new Error(
      `\`stories\` holds an entry that is not a string literal: ${leftover}`,
    );
  }
  if (globs.length === 0) throw new Error('`stories` array is empty');
  if (globs.some((g) => g.includes('${'))) {
    throw new Error('`stories` holds an interpolated template literal');
  }
  return globs;
}

/** The positive string globs in a Tailwind config's `content`. */
export function contentGlobs(config) {
  const content = Array.isArray(config?.content)
    ? config.content
    : config?.content?.files;
  if (!Array.isArray(content)) {
    throw new Error('no `content` array (or `content.files`) found');
  }
  return content
    .filter((entry) => typeof entry === 'string')
    .filter((glob) => !glob.startsWith('!'));
}

/** The first file `pattern` matches from `cwd`, or null. */
export async function firstMatch(pattern, cwd) {
  for await (const path of glob(pattern, {
    cwd,
    exclude: (p) => p.split(/[\\/]/).includes('node_modules'),
  })) {
    return path;
  }
  return null;
}

async function main() {
  const cwd = process.cwd();
  const printOnly = process.argv.includes('--print');
  const require = createRequire(import.meta.url);

  const fail = (msg) => {
    console.error(`content-globs: ${msg}`);
    process.exit(2);
  };

  const { storybook, tailwind } = findConfigs(cwd);
  if (storybook.length + tailwind.length === 0) {
    fail(`no .storybook/main.* or tailwind.config.* found under ${ROOTS}`);
  }

  const checks = [];
  for (const file of storybook) {
    let globs;
    try {
      globs = storiesGlobs(readFileSync(file, 'utf8'));
    } catch (err) {
      fail(`${relative(cwd, file)}: ${err.message}`);
    }
    for (const g of globs) checks.push({ file, kind: 'stories', glob: g });
  }
  for (const file of tailwind) {
    let globs;
    try {
      globs = contentGlobs(require(file));
    } catch (err) {
      fail(`${relative(cwd, file)}: ${err.message}`);
    }
    for (const g of globs) checks.push({ file, kind: 'content', glob: g });
  }

  const dead = [];
  for (const check of checks) {
    const hit = await firstMatch(check.glob, dirname(check.file));
    if (printOnly) {
      console.log(
        `${relative(cwd, check.file)}  ${check.kind}  ${check.glob}  → ${hit ?? '(none)'}`,
      );
    }
    if (hit === null) dead.push(check);
  }

  if (dead.length > 0) {
    console.error('content-globs: glob(s) that match no files:\n');
    for (const { file, kind, glob: g } of dead) {
      console.error(`  ${relative(cwd, file)}: ${kind} glob "${g}"`);
    }
    console.error(
      '\nA dead stories glob drops stories silently; a dead content glob drops' +
        ' Tailwind classes silently (issue #898). Point the glob at where the' +
        ' files now live, or remove it.',
    );
    process.exit(1);
  }

  if (!printOnly) {
    console.log(
      `content-globs: ${checks.length} glob(s) across ${storybook.length + tailwind.length} config(s) all match.`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-content-globs.mjs')) {
  // `fs.glob` is experimental on Node 22 and warns once per process. The
  // warning is noise in gate output; every other warning still prints.
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.name !== 'ExperimentalWarning') console.warn(w);
  });
  await main();
}
