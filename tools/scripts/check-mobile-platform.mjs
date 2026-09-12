#!/usr/bin/env node
// Asserts two mobile platform rules over apps/mobile and libs/mobile source:
// no bare `react-native/` subpath imports, and no browser globals.
//
//   node tools/scripts/check-mobile-platform.mjs [--print]
//
// Both rules were reviewable prose before this file and unenforceable for the
// same underlying reason: nothing in this repo's toolchain checks them.
// `react-native` deep imports are formally deprecated at 0.80 with removal
// planned, but `@react-native/eslint-config` — the package whose rule would
// catch this — is not installed here, so the upstream warning never fires.
// `localStorage`, `sessionStorage`, `window`, `document`, and `crypto.subtle`
// all typecheck inside libs/mobile today, because the base TypeScript config
// puts `dom` in `lib`; CONTEXT.md's Platform Variant entry says a browser API
// belongs only in a file selected by bundler filename resolution for a web
// target, and until now nothing has held mobile source to that.
//
// The subpath-import rule is not a text search for the substring
// `react-native/`. That match has a 3:1 false-positive rate in this exact
// corpus: `apps/mobile/.babelrc.js` names `module:@react-native/babel-preset`,
// `apps/mobile/metro.config.js` requires `@react-native/metro-config`, and
// `apps/mobile/vite.config.mts` aliases `@react-native/assets-registry/registry`
// — three legitimate references to the separate `@react-native/*` scope that
// all contain the substring `react-native/` one character in. The rule instead
// parses each file and looks only at import specifiers and `require(...)`
// call arguments, so a specifier is checked by what it *starts with*, not by
// what it contains. The rule covers all four syntactic ways to name a module
// specifier — `from '...'`, `require('...')`, `require.resolve('...')`, and
// dynamic `import('...')`. `require.resolve` was covered last and is the
// reason `apps/mobile/jest.config.ts` carries an exemption entry: it holds a
// genuine `require.resolve('react-native/jest/assetFileTransformer.js')`, and
// that line is legitimate, so the file is exempted by name with a written
// reason rather than passing because one call form went unparsed. Leaving any
// of the four out would trade one blind spot for another.
//
// The browser-globals rule is not an import scan — `localStorage` and
// `crypto.subtle` are ambient, reached without importing anything — so it
// walks every identifier and property access instead, skipping the positions
// where a name is being declared or is itself a property name rather than a
// reference (`{ window: value }`, `function f(document) {}`).
//
// Skipping the declaration alone is not enough: `function log(window) { return
// window; }` declares a local and then *references* it, and flagging those
// references would fail the pre-commit gate on ordinary shadowing code. So a
// first pass collects every banned name this file declares as a binding, and
// the reference pass skips that name for the whole file. That is deliberately
// coarser than real scope resolution — a file that declares a local `window`
// in one function and reaches the ambient `window` in another gets a pass it
// has not earned. The trade is chosen on which way the error hurts: a false
// positive breaks somebody's commit on correct code, while this false negative
// needs a file that both shadows a browser global and reaches the real one,
// which `dom`-free typechecking and review are better placed to catch.
//
// An ambient re-declaration is not a shadow and does not earn the pass:
// `declare global { const localStorage: ... }` and a top-level `declare const
// window` both *name the real global* rather than introducing a local, so
// treating them as bindings would turn the rule off for that file — and would
// be the obvious way to silence it deliberately.
// A property name is not always a dead end, though: `globalThis.window` and
// `self.localStorage` are how strict-mode code reaches the same ambient
// global by qualifying it, so those two roots are followed rather than
// treated as just another object's property.
//
// Both rules run over the same corpus and share one exemption list
// (tools/config/mobile-platform-exemptions.json), because a file that is
// deliberately allowed a browser API is deliberately allowed to reference
// `react-native-web` however it needs to, and there is exactly one boundary
// worth naming per file, not one per rule.
//
// Exit 0 = zero violations. Exit 1 = a subpath import or a browser global was
// found. Exit 2 = the check could not run (missing/malformed exemption list,
// an exemption naming a file that no longer exists, or a parse failure).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const printOnly = process.argv.includes('--print');

const EXEMPTIONS_PATH = 'tools/config/mobile-platform-exemptions.json';
const SCHEMA_VERSION = 1;
const SOURCE_ROOTS = ['apps/mobile', 'libs/mobile'];
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|mts)$/;

/** Ambient browser globals banned from mobile app and library source. */
const BANNED_BARE_GLOBALS = new Set([
  'localStorage',
  'sessionStorage',
  'window',
  'document',
]);

const fail = (msg) => {
  console.error(`mobile-platform: ${msg}`);
  process.exit(2);
};

let ts;
try {
  ts = require('typescript');
} catch {
  fail('the typescript package is required to parse the corpus');
}

/** Reads and validates the reasoned exemption list. Never returns on error — it exits. */
function readExemptions({ cwd: root = cwd, path = EXEMPTIONS_PATH } = {}) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    fail(`${path} not found — the exemption list is a required artifact`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
  if (parsed?.schemaVersion !== SCHEMA_VERSION) {
    fail(
      `${path}: expected "schemaVersion": ${SCHEMA_VERSION}, found ${JSON.stringify(parsed?.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed?.exemptions)) {
    fail(`${path}: expected an "exemptions" array`);
  }

  const seen = new Set();
  const exemptions = new Map();
  parsed.exemptions.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    const entryPath = typeof entry?.path === 'string' ? entry.path.trim() : '';
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    if (!entryPath) fail(`${at}: entry names no file (\`path\` is required)`);
    if (!reason) {
      fail(
        `${at}: exemption for \`${entryPath}\` carries no written reason. An ` +
          'exemption is a decision somebody made, not a gap nobody saw.',
      );
    }
    if (seen.has(entryPath)) fail(`${at}: \`${entryPath}\` is exempted twice`);
    seen.add(entryPath);
    if (!existsSync(join(root, entryPath))) {
      fail(
        `${at}: \`${entryPath}\` does not exist. An exemption naming a file ` +
          'that is gone is a hole nobody sees.',
      );
    }
    exemptions.set(entryPath, reason);
  });
  return exemptions;
}

/** Every tracked TypeScript/JavaScript file under the mobile app and libraries. */
function sourceFiles({ cwd: root = cwd } = {}) {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files', '-z', '--', ...SOURCE_ROOTS], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    fail(`could not list tracked files: ${error.message}`);
  }
  return tracked
    .split('\0')
    .filter(Boolean)
    .filter((path) => SOURCE_EXTENSIONS.test(path))
    .sort();
}

function scriptKind(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (path.endsWith('.ts') || path.endsWith('.mts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parse(path, text) {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind(path),
  );
}

function lineOf(sourceFile, node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

/** Is this specifier a bare `react-native/...` subpath — never `@react-native/...`? */
function isBannedSubpath(specifier) {
  return specifier.startsWith('react-native/');
}

/** `globalThis` or `self` — the identifiers JavaScript uses to name the global object itself. */
function isGlobalObjectRoot(expr) {
  return (
    ts.isIdentifier(expr) &&
    (expr.text === 'globalThis' || expr.text === 'self')
  );
}

/**
 * A name is a declaration, or a property name, not a reference to whatever
 * global might share its spelling. `{ window: value }`, `function f(document)`,
 * and `import { window } from 'x'` all bind or key a name; none of them reach
 * the ambient global. A property name reached off `globalThis` or `self` is
 * the exception: `globalThis.window` and `self.localStorage` name the same
 * ambient global a bare reference does, so those are never treated as bound.
 */
/**
 * Declaration kinds that introduce a name which can later be *referenced as a
 * bare identifier*. Only these can shadow an ambient global, so this is the
 * list `declaredBannedNames` uses.
 */
const VALUE_BINDING_PARENTS = [
  ts.isVariableDeclaration,
  ts.isParameter,
  ts.isBindingElement,
  ts.isFunctionDeclaration,
  ts.isFunctionExpression,
  ts.isClassDeclaration,
  ts.isClassExpression,
  ts.isImportSpecifier,
  ts.isImportClause,
  ts.isNamespaceImport,
];

/**
 * Declaration kinds whose name is *not* a value binding — a member, a type, or
 * a label. They cannot shadow a global, so `declaredBannedNames` ignores them,
 * but the name at that position is still not a reference, so `isBoundName`
 * must skip it. That asymmetry is the only difference between the two lists:
 * keep it in mind when adding a kind, and add it to the list it belongs to.
 */
const NON_VALUE_NAME_PARENTS = [
  ts.isPropertySignature,
  ts.isPropertyDeclaration,
  ts.isMethodDeclaration,
  ts.isMethodSignature,
  ts.isEnumMember,
  ts.isExportSpecifier,
  ts.isTypeAliasDeclaration,
  ts.isInterfaceDeclaration,
  ts.isLabeledStatement,
];

function isBoundName(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (
    [...VALUE_BINDING_PARENTS, ...NON_VALUE_NAME_PARENTS].some((is) =>
      is(parent),
    ) &&
    parent.name === node
  ) {
    return true;
  }
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isShorthandPropertyAssignment(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  // `import { window as win }` / `export { window as w } from './m'` /
  // `const { window: win } = foo`: the propertyName names a member of the other
  // module or of the object being destructured, not a reference into this file's
  // scope, so it can never reach the ambient global the rule catches. All three
  // share one carve-out because they share one reason.
  if (
    (ts.isImportSpecifier(parent) ||
      ts.isExportSpecifier(parent) ||
      ts.isBindingElement(parent)) &&
    parent.propertyName === node
  ) {
    return true;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return !isGlobalObjectRoot(parent.expression);
  }
  return false;
}

/** `crypto.subtle`, `crypto?.subtle`, or the same reached through a property chain. */
function isCryptoSubtleAccess(node) {
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'subtle') {
    return false;
  }
  const target = node.expression;
  if (ts.isIdentifier(target)) return target.text === 'crypto';
  return ts.isPropertyAccessExpression(target) && target.name.text === 'crypto';
}

/**
 * The four syntactic ways a module specifier can be named, each matched by its
 * own guard so that none is silently skipped, and each reporting with the verb
 * that names what the code actually did. The guards stay separate on purpose —
 * the shared part is only the specifier and the message.
 */
const SPECIFIER_FORMS = [
  {
    verb: 'imports',
    remedy: 'import from the package root or a maintained entry point',
    specifierOf: (node) =>
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier
        : undefined,
  },
  {
    verb: 'requires',
    remedy: 'require from the package root or a maintained entry point',
    specifierOf: (node) =>
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
        ? node.arguments[0]
        : undefined,
  },
  {
    verb: 'resolves',
    remedy: 'resolve from the package root or a maintained entry point',
    specifierOf: (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'require' &&
      node.expression.name.text === 'resolve' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
        ? node.arguments[0]
        : undefined,
  },
  {
    verb: 'dynamically imports',
    remedy: 'import from the package root or a maintained entry point',
    specifierOf: (node) =>
      ts.isImportCall(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
        ? node.arguments[0]
        : undefined,
  },
];

/**
 * Banned names this file declares as its own binding. A reference to one of
 * these is the file's own local, not the ambient global.
 */
function isAmbientRedeclaration(node) {
  for (let n = node; n; n = n.parent) {
    if (ts.isModuleDeclaration(n) && ts.isGlobalScopeAugmentation(n))
      return true;
    if (
      (ts.isVariableStatement(n) ||
        ts.isFunctionDeclaration(n) ||
        ts.isClassDeclaration(n)) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
    ) {
      return true;
    }
  }
  return false;
}

function declaredBannedNames(sourceFile) {
  const declared = new Set();
  const visit = (node) => {
    if (
      ts.isIdentifier(node) &&
      BANNED_BARE_GLOBALS.has(node.text) &&
      node.parent &&
      VALUE_BINDING_PARENTS.some((is) => is(node.parent)) &&
      node.parent.name === node &&
      !isAmbientRedeclaration(node)
    ) {
      declared.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declared;
}

/**
 * Both rules in one pass: module specifiers for the subpath rule, every
 * identifier and property access for the browser-globals rule.
 */
function inspect(path, sourceFile) {
  const findings = [];
  const shadowed = declaredBannedNames(sourceFile);

  const visit = (node) => {
    for (const { verb, remedy, specifierOf } of SPECIFIER_FORMS) {
      const specifier = specifierOf(node);
      if (!specifier || !isBannedSubpath(specifier.text)) continue;
      findings.push(
        `${path}:${lineOf(sourceFile, node)}: ${verb} '${specifier.text}' — ` +
          'a bare react-native/ subpath. Deep imports are deprecated at 0.80 with ' +
          `removal planned; ${remedy}.`,
      );
    }

    if (
      ts.isIdentifier(node) &&
      BANNED_BARE_GLOBALS.has(node.text) &&
      !shadowed.has(node.text) &&
      !isBoundName(node)
    ) {
      findings.push(
        `${path}:${lineOf(sourceFile, node)}: references the browser global \`${node.text}\`. ` +
          "CONTEXT.md's Platform Variant is the only place mobile source may hold a " +
          'browser API; reach the platform through a Platform Adapter or Platform Variant instead.',
      );
    }

    if (isCryptoSubtleAccess(node)) {
      findings.push(
        `${path}:${lineOf(sourceFile, node)}: references \`crypto.subtle\`. ` +
          'WebCrypto is a browser API; reach it only through the vault crypto ' +
          'Platform Variant, never from shared mobile source.',
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

const exemptions = readExemptions();
const files = sourceFiles();

if (printOnly) {
  console.log(`mobile-platform: ${files.length} file(s) scanned`);
  for (const [path, reason] of exemptions) {
    console.log(`  exempt: ${path}`);
    console.log(`    ${reason}`);
  }
}

const findings = [];
for (const path of files) {
  if (exemptions.has(path)) continue;
  const text = readFileSync(join(cwd, path), 'utf8');
  let sourceFile;
  try {
    sourceFile = parse(path, text);
  } catch (error) {
    fail(`could not parse ${path}: ${error.message}`);
  }
  findings.push(...inspect(path, sourceFile));
}

if (findings.length > 0) {
  console.error(
    'mobile-platform: react-native subpath import or browser global found\n',
  );
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(
  `mobile-platform: OK — ${files.length} file(s) scanned, ${exemptions.size} exempted, 0 violations`,
);
