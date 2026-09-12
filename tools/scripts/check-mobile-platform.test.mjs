import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, 'check-mobile-platform.mjs');

/**
 * The checker reads tracked TypeScript/JavaScript under apps/mobile and
 * libs/mobile, so a fixture needs a real repository. `git ls-files` returns
 * nothing otherwise and the checker would pass by seeing no corpus at all —
 * the failure mode a gate must never have.
 */
function createRepo(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'mobile-platform-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: workspace, stdio: 'ignore' });
  return workspace;
}

function write(workspace, relative, contents) {
  const path = join(workspace, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function writeExemptions(workspace, exemptions = []) {
  write(
    workspace,
    'tools/config/mobile-platform-exemptions.json',
    JSON.stringify({ schemaVersion: 1, exemptions }, null, 2),
  );
}

function commitAll(workspace) {
  execFileSync('git', ['add', '-A'], { cwd: workspace, stdio: 'ignore' });
}

const run = (workspace, ...args) =>
  spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: workspace,
    encoding: 'utf8',
  });

/** A workspace carrying an empty exemption list plus `files`. */
function scaffold(t, files = {}, exemptions = []) {
  const workspace = createRepo(t);
  writeExemptions(workspace, exemptions);
  for (const [path, contents] of Object.entries(files)) {
    write(workspace, path, contents);
  }
  commitAll(workspace);
  return workspace;
}

test('passes an empty corpus', (t) => {
  const workspace = scaffold(t);
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 file\(s\) scanned/);
});

test('passes clean React Native source', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/app/App.tsx': `import { View } from 'react-native';
export default function App() {
  return <View />;
}
`,
    'libs/mobile/ui/src/theme.ts': `export const theme = { color: 'blue' };
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('fails a bare react-native subpath reached through `from`', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/utils/src/index.ts': `import { TurboModuleRegistry } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';
export { TurboModuleRegistry };
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /imports 'react-native\/Libraries\/TurboModule\/TurboModuleRegistry' — a bare react-native\/ subpath/,
  );
});

test('fails a bare react-native subpath reached through `require`', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/some.config.js': `const transformer = require('react-native/jest/assetFileTransformer.js');
module.exports = transformer;
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /requires 'react-native\/jest\/assetFileTransformer\.js' — a bare react-native\/ subpath/,
  );
});

// `require.resolve` is a property access on `require` rather than a call to it,
// so it needs its own clause. `apps/mobile/jest.config.ts` holds exactly this
// call in the real repo and is exempted by name; an unexempted file is not.
test('fails a bare react-native subpath reached through `require.resolve`', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/some.config.ts': `module.exports = {
  transform: {
    '^.+\\\\.(png)$': require.resolve('react-native/jest/assetFileTransformer.js'),
  },
};
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /resolves 'react-native\/jest\/assetFileTransformer\.js' — a bare react-native\/ subpath/,
  );
});

// An import specifier's propertyName names a member of the *other* module. It
// can never reach the ambient global, so aliasing one to a banned name is not a
// violation — `import { window as win } from './local'` is somebody else's
// export called `window`, not a browser API.
test('does not flag an import specifier merely aliased from a banned global name', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/thing.ts': `import { window as win, document as doc } from './local-module';

export const size = win;
export const root = doc;
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

// Skipping the declaration but not its later uses was a false positive that
// would have failed the pre-commit gate on ordinary shadowing code.
test('does not flag later references to a local that shadows a banned global', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/shadow.ts': `export function log(window: number) {
  console.log(window);
  return window;
}

export function pick(document: string[]) {
  return document.length;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('does not flag a local const shadowing a banned global, nor its uses', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/localvar.ts': `const localStorage = new Map<string, string>();

export function put(k: string, v: string) {
  localStorage.set(k, v);
  return localStorage.size;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

// The shadow suppression is per name, not per file: a file that shadows one
// banned name must still be held to the others.
test('still flags a different banned global in a file that shadows one', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/mixed.ts': `export function log(window: number) {
  return window;
}

export const stored = localStorage.getItem('k');
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references the browser global `localStorage`/);
  assert.doesNotMatch(result.stderr, /references the browser global `window`/);
});

// The same reasoning for a re-export, where the propertyName sits on an
// ExportSpecifier instead.
test('does not flag a re-exported specifier aliased from a banned global name', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/reexport.ts': `export { window as win } from './local-module';
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

// A naive substring match on \`react-native/\` hits all three of these — each
// is a reference to the separate \`@react-native/*\` scope one character in.
test('does not flag the @react-native/ scope: babel preset, metro config, vite alias', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/.babelrc.js': `module.exports = {
  presets: [['module:@react-native/babel-preset', { useTransformReactJSX: true }]],
};
`,
    'apps/mobile/metro.config.js': `const { getDefaultConfig } = require('@react-native/metro-config');
module.exports = getDefaultConfig(__dirname);
`,
    'apps/mobile/vite.config.mts': `export default {
  resolve: {
    alias: {
      '@react-native/assets-registry/registry':
        'react-native-web/dist/modules/AssetRegistry/index',
    },
  },
};
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('fails a bare window reference', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/hooks/src/useViewport.ts': `export function useViewport() {
  return window.innerWidth;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references the browser global `window`/);
});

test('fails localStorage and sessionStorage the same way as window', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/utils/src/storage.ts': `export function readBoth() {
  return [localStorage.getItem('a'), sessionStorage.getItem('b')];
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references the browser global `localStorage`/);
  assert.match(result.stderr, /references the browser global `sessionStorage`/);
});

// This is the shape a checker written as an import scan would miss —
// localStorage and crypto.subtle are ambient, reached without an import.
test('fails an ambient global with no import in sight', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/feat/vault/src/leak.ts': `export function stash(key: string, value: string) {
  localStorage.setItem(key, value);
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references the browser global `localStorage`/);
});

test('fails crypto.subtle and the optional-chained form', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/feat/vault/src/leak.ts': `export async function encrypt() {
  if (typeof globalThis.crypto?.subtle === 'undefined') throw new Error('no subtle');
  return globalThis.crypto.subtle.digest('SHA-256', new Uint8Array());
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  const matches = result.stderr.match(/references `crypto\.subtle`/g) ?? [];
  assert.equal(matches.length, 2);
});

test('does not flag window or document used as a property or parameter name', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/ui/src/mock.ts': `export function describeScreen({ window }: { window: number }) {
  const config = { window, document: 'unused' };
  return config;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

// `.window`/`.document` alone is somebody's own property name — e.g. a
// screen config object — and must stay unflagged even though it shares a
// spelling with the property-name shapes above.
test('does not flag window or document reached off an arbitrary object', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/screens/src/config.ts': `export function describe(screen: { window: number; document: string }) {
  return screen.window + screen.document.length;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

// Qualifying a banned global through `globalThis` or `self` reaches the same
// ambient global a bare reference does — it must not read as "just another
// object's property" the way `screen.window` above does.
test('fails a browser global qualified through globalThis or self', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/utils/src/leak.ts': `export function stash(key: string, value: string) {
  globalThis.localStorage.setItem(key, value);
  return self.window.innerWidth + globalThis.document.title.length;
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /references the browser global `localStorage`/);
  assert.match(result.stderr, /references the browser global `window`/);
  assert.match(result.stderr, /references the browser global `document`/);
});

test('fails a bare react-native subpath reached through dynamic import()', (t) => {
  const workspace = scaffold(t, {
    'libs/mobile/utils/src/lazy.ts': `export async function load() {
  return import('react-native/Libraries/TurboModule/TurboModuleRegistry');
}
`,
  });
  const result = run(workspace);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /dynamically imports 'react-native\/Libraries\/TurboModule\/TurboModuleRegistry' — a bare react-native\/ subpath/,
  );
});

test('exempts a file by path, skipping both rules for it', (t) => {
  const workspace = scaffold(
    t,
    {
      'apps/mobile/src/main-web.tsx': `import * as ReactDOM from 'react-dom/client';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(null);
`,
    },
    [
      {
        path: 'apps/mobile/src/main-web.tsx',
        reason: 'The Vite web entry point; not a variant of anything else.',
      },
    ],
  );
  const result = run(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('cannot run when an exemption names a file that no longer exists', (t) => {
  const workspace = scaffold(t, {}, [
    {
      path: 'apps/mobile/src/gone.ts',
      reason: 'Used to be a Platform Variant; the file has since been deleted.',
    },
  ]);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not exist/);
});

test('cannot run when an exemption carries no reason', (t) => {
  const workspace = scaffold(t, {
    'apps/mobile/src/main-web.tsx': `export {};\n`,
  });
  write(
    workspace,
    'tools/config/mobile-platform-exemptions.json',
    JSON.stringify({
      schemaVersion: 1,
      exemptions: [{ path: 'apps/mobile/src/main-web.tsx', reason: '' }],
    }),
  );
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /carries no written reason/);
});

test('cannot run when the exemption list is missing', (t) => {
  const workspace = createRepo(t);
  write(workspace, 'apps/mobile/src/App.tsx', 'export {};\n');
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not found/);
});

test('cannot run when the exemption list has the wrong schema version', (t) => {
  const workspace = createRepo(t);
  write(
    workspace,
    'tools/config/mobile-platform-exemptions.json',
    JSON.stringify({ schemaVersion: 2, exemptions: [] }),
  );
  commitAll(workspace);
  const result = run(workspace);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expected "schemaVersion": 1/);
});

test('--print reports scanned count and exemptions with reasons', (t) => {
  const workspace = scaffold(
    t,
    {
      'apps/mobile/src/main-web.tsx': `export {};\n`,
    },
    [{ path: 'apps/mobile/src/main-web.tsx', reason: 'The web entry point.' }],
  );
  const result = run(workspace, '--print');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 file\(s\) scanned/);
  assert.match(result.stdout, /exempt: apps\/mobile\/src\/main-web\.tsx/);
  assert.match(result.stdout, /The web entry point\./);
});
