import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
const CHECKER_SOURCE = join(SCRIPT_DIR, 'check-component-hygiene.mjs');
const SCAN_SOURCE = join(SCRIPT_DIR, 'lib', 'source-scan.mjs');

function writeFixture(workspace, relativePath, content) {
  const file = join(workspace, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return relativePath;
}

function createWorkspace(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'component-hygiene-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  writeFixture(
    workspace,
    'tools/scripts/check-component-hygiene.mjs',
    readFileSync(CHECKER_SOURCE, 'utf8'),
  );
  writeFixture(
    workspace,
    'tools/scripts/lib/source-scan.mjs',
    readFileSync(SCAN_SOURCE, 'utf8'),
  );

  return workspace;
}

function runChecker(workspace, ...args) {
  const checkerPath = join(
    workspace,
    'tools/scripts/check-component-hygiene.mjs',
  );
  return spawnSync(process.execPath, [checkerPath, ...args], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

function git(workspace, ...args) {
  return execFileSync('git', args, { cwd: workspace, encoding: 'utf8' });
}

function initializeRepository(workspace) {
  git(workspace, 'init', '--quiet');
  git(workspace, 'config', 'user.email', 'test@example.com');
  git(workspace, 'config', 'user.name', 'Test');
}

test('explicit feature fixture with warning exits 0 and reports warning in advisory mode', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, file);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /handler-not-memoized/);
  assert.match(result.stdout, /0 error\(s\), 1 warning\(s\)/);
});

test('feature fixture with warning exits 1 with --max-warnings=0 while retaining warning output', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--max-warnings=0', file);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /handler-not-memoized/);
  assert.match(result.stdout, /0 error\(s\), 1 warning\(s\)/);
});

test('strict JSON warning exits 1 and produces exact top-level keys', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/WarningComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function WarningComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', '--max-warnings=0', file);

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(parsed), ['errors', 'warnings', 'results']);
  assert.equal(parsed.errors, 0);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].file, file);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
});

test('error fixture exits 1 in advisory and strict modes', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ErrorComponent.tsx',
    [
      "import { Button } from '@myorganizer/web-ui/src/lib/components/button/Button';",
      '',
      'export function ErrorComponent() {',
      '  return <Button />;',
      '}',
      '',
    ].join('\n'),
  );

  const advisoryResult = runChecker(workspace, file);
  assert.equal(advisoryResult.status, 1);
  assert.match(advisoryResult.stdout, /deep-import/);

  const strictResult = runChecker(workspace, '--max-warnings=0', file);
  assert.equal(strictResult.status, 1);
  assert.match(strictResult.stdout, /deep-import/);
});

test('CLI misuse exits 2 and prints usage information', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.tsx',
    'export function Component() { return <div />; }\n',
  );

  const cases = [
    ['--unknown'],
    ['--max-warnings=1'],
    ['--all', '--staged'],
    ['--all', file],
    ['--staged', file],
  ];

  for (const args of cases) {
    const result = runChecker(workspace, ...args);
    assert.equal(
      result.status,
      2,
      `Expected exit code 2 for args: ${args.join(' ')}`,
    );
    assert.match(result.stderr, /Usage:/);
  }
});

test('empty staged selection exits 0 in text and JSON modes', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);
  writeFixture(workspace, 'README.md', '# Readme\n');
  git(workspace, 'add', 'README.md');

  const textResult = runChecker(workspace, '--staged');
  assert.equal(textResult.status, 0);
  assert.equal(textResult.stdout.trim(), 'No staged component files to check.');

  const jsonResult = runChecker(workspace, '--staged', '--json');
  assert.equal(jsonResult.status, 0);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.deepEqual(parsed, { errors: 0, warnings: 0, results: [] });
});

test('--staged inspects staged added/modified files and ignores unstaged files', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const modifiedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ModifiedComponent.tsx',
    'export function ModifiedComponent() { return <div />;\n }\n',
  );
  git(workspace, 'add', modifiedFile);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  writeFixture(
    workspace,
    modifiedFile,
    [
      "import * as React from 'react';",
      '',
      'export function ModifiedComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );
  git(workspace, 'add', modifiedFile);

  const addedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/AddedComponent.tsx',
    'export function AddedComponent() { return <div />; }\n',
  );
  git(workspace, 'add', addedFile);

  const unstagedFile = writeFixture(
    workspace,
    'libs/web/pages/todos/src/UnstagedComponent.tsx',
    "import { Button } from '@myorganizer/web-ui/src/lib/components/button/Button';\nexport function UnstagedComponent() { return <Button />; }\n",
  );

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const resultFiles = parsed.results.map((r) => r.file);

  assert.ok(resultFiles.includes(addedFile));
  assert.ok(resultFiles.includes(modifiedFile));
  assert.equal(resultFiles.length, 2);
  assert.ok(!resultFiles.includes(unstagedFile));

  const modifiedResult = parsed.results.find((r) => r.file === modifiedFile);
  assert.ok(modifiedResult);
  assert.ok(
    modifiedResult.findings.some((f) => f.rule === 'handler-not-memoized'),
  );
});

test('--staged handles renamed files with spaces in destination path', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const oldPath = writeFixture(
    workspace,
    'libs/web/pages/todos/src/OldComponent.tsx',
    'export function OldComponent() { return <div />; }\n',
  );
  git(workspace, 'add', oldPath);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  const newPath = 'libs/web/pages/todos/src/New Component With Spaces.tsx';
  git(workspace, 'mv', oldPath, newPath);

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const resultFiles = parsed.results.map((r) => r.file);
  assert.deepEqual(resultFiles, [newPath]);
  assert.ok(!resultFiles.includes(oldPath));
});

test('--staged ignores deleted component files and out-of-scope files', (t) => {
  const workspace = createWorkspace(t);
  initializeRepository(workspace);

  const componentPath = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ToDelete.tsx',
    'export function ToDelete() { return <div />; }\n',
  );
  git(workspace, 'add', componentPath);
  git(workspace, 'commit', '--quiet', '-m', 'initial');

  git(workspace, 'rm', componentPath);

  writeFixture(workspace, 'README.md', '# Readme\n');
  writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.test.tsx',
    "test('noop', () => {});\n",
  );
  writeFixture(
    workspace,
    'libs/web/pages/todos/src/Component.stories.tsx',
    'export default {};\n',
  );
  writeFixture(workspace, 'tools/scripts/something.js', 'console.log();\n');

  git(
    workspace,
    'add',
    'README.md',
    'libs/web/pages/todos/src/Component.test.tsx',
    'libs/web/pages/todos/src/Component.stories.tsx',
    'tools/scripts/something.js',
  );

  const result = runChecker(workspace, '--staged', '--json');

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, { errors: 0, warnings: 0, results: [] });
  assert.doesNotMatch(result.stderr, /unreadable/);
});

test('--staged outside a Git repository fails with nonzero exit code', (t) => {
  const workspace = createWorkspace(t);

  const result = runChecker(workspace, '--staged');

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /No staged component files to check/);
});

test('vault UI component is inspected rather than skipped', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web-vault-ui/src/lib/ExampleNotice.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function ExampleNotice() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, file);

  // The regression this guards: the whole library used to fall out of
  // scopeOf() and report SKIPPED, so nothing in it was ever inspected.
  assert.doesNotMatch(result.stdout, /SKIPPED/);
  assert.match(result.stdout, /handler-not-memoized/);
});

test('vault UI component is checked against primitive rules too, not only feature rules', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web-vault-ui/src/lib/TemplateClassNotice.tsx',
    [
      "import * as React from 'react';",
      '',
      'export interface TemplateClassNoticeProps {',
      '  className?: string;',
      '}',
      '',
      'export function TemplateClassNotice({ className }: TemplateClassNoticeProps) {',
      '  return <div className={`flex ${className}`}>hi</div>;',
      '}',
      '',
    ].join('\n'),
  );

  // classname-not-cn is a primitive rule. A Vault UI Component filed under the
  // feature scope would not be checked for it, which is what the declarative
  // SCOPE_RULES table exists to prevent.
  const result = runChecker(workspace, file);

  assert.match(result.stdout, /classname-not-cn/);
});

test('vault UI component missing from its own barrel is reported', (t) => {
  const workspace = createWorkspace(t);
  writeFixture(
    workspace,
    'libs/web-vault-ui/src/index.ts',
    "export * from './lib/SomethingElse';\n",
  );
  const file = writeFixture(
    workspace,
    'libs/web-vault-ui/src/lib/UnexportedNotice.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function UnexportedNotice() {',
      '  return <div>hi</div>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, file);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing-barrel-export/);
  assert.match(result.stdout, /libs\/web-vault-ui\/src\/index\.ts/);
});

test('a hook beside the components is not inspected as a component', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web-vault-ui/src/lib/useSomething.ts',
    ['export function useSomething() {', '  return 1;', '}', ''].join('\n'),
  );

  const result = runChecker(workspace, file);

  // This library keeps hooks and copy modules beside its components. A .ts
  // hook reporting PASS as a component would be a false clean.
  assert.match(result.stdout, /SKIPPED/);
});

test('an apostrophe in JSX text does not mask the rest of the file', (t) => {
  const workspace = createWorkspace(t);
  const body = Array.from(
    { length: 40 },
    (_, index) => `        <span>row ${index}</span>`,
  ).join('\n');
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ApostropheComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function ApostropheComponent() {',
      '  return (',
      '    <div>',
      "      <p>Replace this device's vault?</p>",
      body,
      '    </div>',
      '  );',
      '}',
      '',
      'export function SecondComponent() {',
      '  const handleClick = () => {};',
      '  return <button onClick={handleClick}>Click</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, file);

  // The apostrophe in "device's" used to open a string that ran to the next
  // apostrophe far below, blanking real code from the masked copy. That left
  // brace and paren scanning unbalanced and made one 15-line JSX block measure
  // as 451 lines. Code after the apostrophe must still be seen.
  assert.doesNotMatch(result.stdout, /oversized-jsx/);
  assert.match(result.stdout, /handler-not-memoized/);
});

test('expression-bodied member call is reported as handler-not-memoized', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/MemberCallComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function MemberCallComponent() {',
      '  const cloud = { connect() {} };',
      '  return <button onClick={() => void cloud.connect()}>Connect</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
});

test('thin wrapper calling a useCallback binding with extra arguments is not a finding', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/ThinWrapperComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'interface ThinWrapperComponentProps { id: string }',
      'export function ThinWrapperComponent({ id }: ThinWrapperComponentProps) {',
      '  const handleDelete = React.useCallback((_id: string) => {}, []);',
      '  return <button onClick={() => handleDelete(id)}>Delete</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 0);
  assert.equal(parsed.results[0].findings.length, 0);
});

test('unparenthesized local arrow called from a thin wrapper is still a finding', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/BareParamWrapperComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'interface BareParamWrapperComponentProps { id: string }',
      'export function BareParamWrapperComponent({ id }: BareParamWrapperComponentProps) {',
      '  const handleDelete = _id => {};',
      '  return <button onClick={() => handleDelete(id)}>Delete</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
});

test('thin wrapper calling an unmemoized local function is still a finding', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/UnmemoizedWrapperComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'interface UnmemoizedWrapperComponentProps { id: string }',
      'export function UnmemoizedWrapperComponent({ id }: UnmemoizedWrapperComponentProps) {',
      '  const handleDelete = (_id: string) => {};',
      '  return <button onClick={() => handleDelete(id)}>Delete</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
});

test('expression-bodied setter wrapper is not a finding', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/SetterWrapperComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function SetterWrapperComponent() {',
      '  const [open, setOpen] = React.useState(false);',
      '  return <button onClick={() => setOpen(true)}>{String(open)}</button>;',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 0, JSON.stringify(parsed.results[0]?.findings));
  assert.equal(parsed.results[0].findings.length, 0);
});

test('inline function expression with a statement body is reported as handler-not-memoized', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/InlineFnComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function InlineFnComponent() {',
      '  return (',
      '    <button',
      '      onClick={function () {',
      "        window.alert('clicked');",
      '      }}',
      '    >',
      '      Click',
      '    </button>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
  assert.match(parsed.results[0].findings[0].message, /inline/i);
});

test('inline arrow with a statement body is reported as handler-not-memoized', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/InlineArrowComponent.tsx',
    [
      "import * as React from 'react';",
      '',
      'export function InlineArrowComponent() {',
      '  return (',
      '    <button',
      '      onClick={() => {',
      "        window.alert('clicked');",
      '      }}',
      '    >',
      '      Click',
      '    </button>',
      '  );',
      '}',
      '',
    ].join('\n'),
  );

  const result = runChecker(workspace, '--json', file);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings, 1);
  assert.equal(parsed.results[0].findings[0].rule, 'handler-not-memoized');
  assert.match(parsed.results[0].findings[0].message, /inline/i);
});

test('summary distinguishes a run that skipped everything from a clean run', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/some-other-lib/src/Thing.tsx',
    ['export function Thing() {', '  return <div>hi</div>;', '}', ''].join(
      '\n',
    ),
  );

  const result = runChecker(workspace, file);

  assert.equal(result.status, 0);
  // "0 error(s), 0 warning(s)" alone is what let a whole unchecked library
  // look green. The summary has to say nothing was inspected.
  assert.match(
    result.stdout,
    /0 file\(s\) inspected, 1 skipped as out of scope/,
  );
});

function exportBasenameFindings(workspace, file) {
  const result = runChecker(workspace, '--json', file);
  const parsed = JSON.parse(result.stdout);
  const findings = parsed.results[0]?.findings ?? [];
  return {
    status: result.status,
    stderr: result.stderr,
    findings: findings.filter((f) => f.rule === 'export-basename'),
    all: findings,
  };
}

function setExportBasenameExemptions(workspace, literal) {
  const checkerPath = join(
    workspace,
    'tools/scripts/check-component-hygiene.mjs',
  );
  const source = readFileSync(checkerPath, 'utf8');
  const next = source.replace(
    'const EXPORT_BASENAME_EXEMPTIONS = [];',
    `const EXPORT_BASENAME_EXEMPTIONS = ${literal};`,
  );
  assert.notEqual(next, source, 'exemption splice did not match source');
  writeFileSync(checkerPath, next);
}

test('feature components/ file whose export matches the basename is clean', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/MatchName.tsx',
    'export function MatchName() { return <div />; }\n',
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 0);
  assert.equal(findings.length, 0);
});

test('feature components/ file that exports no matching component is an error', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/AddItemFormFields.tsx',
    [
      'export function AddItemMetadataFields() { return <div />; }',
      'export function AddItemDetailsFields() { return <div />; }',
      '',
    ].join('\n'),
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 1);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /AddItemFormFields/);
  assert.match(findings[0].message, /AddItemDetailsFields/);
});

test('feature components/ file with a matching export plus another component is an error', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/AddressDetailLoading.tsx',
    [
      'export function AddressDetailLoading() { return <div />; }',
      'export function AddressDetailNotFound() { return <div />; }',
      '',
    ].join('\n'),
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 1);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /more than one/);
});

test('feature file outside components/ may export more than one component', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/page.tsx',
    [
      'export function AddressesPage() { return <div />; }',
      'export function Extra() { return <div />; }',
      '',
    ].join('\n'),
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 0);
  assert.equal(findings.length, 0);
});

test('kebab-case feature filename maps to PascalCase export', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/task-add-dialog.tsx',
    'export function TaskAddDialog() { return <div />; }\n',
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 0);
  assert.equal(findings.length, 0);
});

test('default export matching the basename counts as the component', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/LandingContent.tsx',
    'export default function LandingContent() { return <div />; }\n',
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 0);
  assert.equal(findings.length, 0);
});

test('camelCase helper plus matching component is not a second component export', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/DynamicBreadcrumb.tsx',
    [
      'export function getBreadcrumbItems() { return []; }',
      'export function DynamicBreadcrumb() { return <div />; }',
      '',
    ].join('\n'),
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 0);
  assert.equal(findings.length, 0);
});

test('primitive compound file passes when the basename matches the root export', (t) => {
  const workspace = createWorkspace(t);
  writeFixture(
    workspace,
    'libs/web-ui/src/index.ts',
    "export * from './lib/components/Card/Card';\n",
  );
  const file = writeFixture(
    workspace,
    'libs/web-ui/src/lib/components/Card/Card.tsx',
    [
      'const Card = () => <div />;',
      'const CardHeader = () => <div />;',
      'export { Card, CardHeader };',
      '',
    ].join('\n'),
  );

  const { findings } = exportBasenameFindings(workspace, file);
  assert.equal(findings.length, 0);
});

test('primitive file with no basename-matching root is an error', (t) => {
  const workspace = createWorkspace(t);
  writeFixture(
    workspace,
    'libs/web-ui/src/index.ts',
    "export * from './lib/components/Card/Card';\n",
  );
  const file = writeFixture(
    workspace,
    'libs/web-ui/src/lib/components/Card/Card.tsx',
    'export function CardHeader() { return <div />; }\n',
  );

  const { status, findings } = exportBasenameFindings(workspace, file);
  assert.equal(status, 1);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /compound root/);
});

test('vault-ui camelCase module is not treated as a Vault UI Component basename', (t) => {
  const workspace = createWorkspace(t);
  writeFixture(
    workspace,
    'libs/web-vault-ui/src/index.ts',
    "export * from './lib/session';\n",
  );
  const file = writeFixture(
    workspace,
    'libs/web-vault-ui/src/lib/session.tsx',
    'export function VaultSessionProvider() { return <div />; }\n',
  );

  const { findings } = exportBasenameFindings(workspace, file);
  assert.equal(findings.length, 0);
});

test('a reasoned exemption skips the export-basename rule', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/AddItemFormFields.tsx',
    [
      'export function AddItemMetadataFields() { return <div />; }',
      'export function AddItemDetailsFields() { return <div />; }',
      '',
    ].join('\n'),
  );
  setExportBasenameExemptions(
    workspace,
    JSON.stringify([
      {
        path: 'libs/web/pages/todos/src/components/AddItemFormFields.tsx',
        reason: 'test fixture: deliberate multi-export',
      },
    ]),
  );

  const { findings } = exportBasenameFindings(workspace, file);
  assert.equal(findings.length, 0);
});

test('an exemption without a reason is rejected', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/MatchName.tsx',
    'export function MatchName() { return <div />; }\n',
  );
  setExportBasenameExemptions(
    workspace,
    JSON.stringify([{ path: file, reason: '' }]),
  );

  const result = runChecker(workspace, file);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /written reason/);
});

test('an exemption naming a file that is gone is rejected', (t) => {
  const workspace = createWorkspace(t);
  const file = writeFixture(
    workspace,
    'libs/web/pages/todos/src/components/MatchName.tsx',
    'export function MatchName() { return <div />; }\n',
  );
  setExportBasenameExemptions(
    workspace,
    JSON.stringify([
      {
        path: 'libs/web/pages/todos/src/components/Gone.tsx',
        reason: 'used to be a compound file',
      },
    ]),
  );

  const result = runChecker(workspace, file);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not exist/);
});
