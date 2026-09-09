import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_SITES_PER_OBLIGATION,
  ObligationError,
  assertObligationCatalogue,
  checkAnswers,
  globToRegExp,
  loadObligationCatalogue,
  parseAddedLines,
  selectObligations,
} from './obligations.mjs';

const obligation = (over = {}) => ({
  id: 'an-obligation',
  title: 'An obligation',
  question: 'Answer this.',
  answerFields: ['a', 'b'],
  defect: 'a is false',
  trigger: { paths: ['libs/**'] },
  seededFrom: '#1',
  goldenCase: 'a-case',
  ...over,
});

const catalogue = (obligations = [obligation()]) => ({
  schemaVersion: 1,
  obligations,
});

const diff = (...lines) => lines.join('\n');

test('a well-formed catalogue is accepted', () => {
  assert.equal(assertObligationCatalogue(catalogue()).obligations.length, 1);
});

test('the catalogue rejects what would make it untrustworthy', () => {
  const bad = [
    [{ ...catalogue(), schemaVersion: 2 }, /schemaVersion/],
    [{ ...catalogue(), obligations: [] }, /non-empty/],
    [catalogue([obligation({ id: 'Not A Slug' })]), /lowercase slug/],
    [catalogue([obligation(), obligation()]), /duplicate obligation id/],
    [catalogue([obligation({ question: '' })]), /question/],
    [catalogue([obligation({ answerFields: [] })]), /answerFields/],
    [catalogue([obligation({ answerFields: ['a', 'a'] })]), /duplicate/],
    [catalogue([obligation({ trigger: { paths: [] } })]), /trigger.paths/],
    [
      catalogue([obligation({ trigger: { paths: ['x'], addedPattern: '(' } })]),
      /bad pattern/,
    ],
  ];
  for (const [cat, re] of bad) {
    assert.throws(() => assertObligationCatalogue(cat), ObligationError);
    assert.throws(() => assertObligationCatalogue(cat), re);
  }
});

test('an entry must cite the incident and the case that score it', () => {
  // Without these the catalogue can grow on prudence, which is the brief that
  // did not work. They are the difference between evidence and opinion.
  assert.throws(
    () =>
      assertObligationCatalogue(catalogue([obligation({ seededFrom: '' })])),
    /seededFrom/,
  );
  assert.throws(
    () =>
      assertObligationCatalogue(catalogue([obligation({ goldenCase: '' })])),
    /goldenCase/,
  );
});

test('globs match paths, and ** crosses separators where * does not', () => {
  assert.ok(globToRegExp('libs/**').test('libs/web-vault/src/a.ts'));
  assert.ok(globToRegExp('package.json').test('package.json'));
  assert.ok(!globToRegExp('libs/*').test('libs/a/b.ts'));
  assert.ok(globToRegExp('libs/*').test('libs/a.ts'));
  assert.ok(!globToRegExp('libs/**').test('apps/libs/a.ts'));
  // A dot is literal, not "any character".
  assert.ok(!globToRegExp('package.json').test('packageXjson'));
});

test('added lines carry their head line numbers', () => {
  const added = parseAddedLines(
    diff(
      'diff --git a/libs/a.ts b/libs/a.ts',
      '--- a/libs/a.ts',
      '+++ b/libs/a.ts',
      '@@ -1,0 +10,2 @@',
      '+first',
      '+second',
      '@@ -20,1 +30,1 @@',
      '-gone',
      '+third',
    ),
  );
  assert.deepEqual(added.get('libs/a.ts'), [
    { line: 10, text: 'first' },
    { line: 11, text: 'second' },
    { line: 30, text: 'third' },
  ]);
});

test('a removal-only file contributes no sites', () => {
  const added = parseAddedLines(
    diff(
      '--- a/libs/a.ts',
      '+++ b/libs/a.ts',
      '@@ -1,2 +0,0 @@',
      '-one',
      '-two',
    ),
  );
  assert.deepEqual(added.get('libs/a.ts'), []);
});

test('a path-only trigger fires on the file at its first changed line', () => {
  const added = parseAddedLines(
    diff('--- a/x', '+++ b/libs/a.ts', '@@ -0,0 +7,1 @@', '+anything'),
  );
  const { selected } = selectObligations({
    catalogue: catalogue(),
    addedLines: added,
    head: 'abc',
  });
  assert.deepEqual(selected[0].sites, [{ file: 'libs/a.ts', line: 7 }]);
});

test('a content trigger fires only on added lines that match', () => {
  const cat = catalogue([
    obligation({ trigger: { paths: ['libs/**'], addedPattern: 'needle' } }),
  ]);
  const added = parseAddedLines(
    diff(
      '--- a/x',
      '+++ b/libs/a.ts',
      '@@ -0,0 +1,3 @@',
      '+haystack',
      '+has needle here',
      '+haystack',
    ),
  );
  const { selected } = selectObligations({
    catalogue: cat,
    addedLines: added,
    head: 'abc',
  });
  assert.deepEqual(selected[0].sites, [{ file: 'libs/a.ts', line: 2 }]);
});

test('an obligation whose paths do not match does not fire at all', () => {
  const added = parseAddedLines(
    diff('--- a/x', '+++ b/apps/a.ts', '@@ -0,0 +1,1 @@', '+anything'),
  );
  const { selected } = selectObligations({
    catalogue: catalogue(),
    addedLines: added,
    head: 'abc',
  });
  // A diff that triggers nothing costs nothing: no entry, no prompt tokens.
  assert.deepEqual(selected, []);
});

test('sites are capped and the overflow is counted, not dropped silently', () => {
  const lines = ['--- a/x', '+++ b/libs/a.ts', '@@ -0,0 +1,40 @@'];
  for (let i = 0; i < 40; i += 1) lines.push('+needle');
  const cat = catalogue([
    obligation({ trigger: { paths: ['libs/**'], addedPattern: 'needle' } }),
  ]);
  const { selected } = selectObligations({
    catalogue: cat,
    addedLines: parseAddedLines(diff(...lines)),
    head: 'abc',
  });
  assert.equal(selected[0].sites.length, MAX_SITES_PER_OBLIGATION);
  assert.equal(selected[0].truncated, 40 - MAX_SITES_PER_OBLIGATION);
});

const worklist = {
  head: 'abc',
  selected: [
    {
      id: 'an-obligation',
      title: 'An obligation',
      question: 'Answer this.',
      answerFields: ['a', 'b'],
      defect: 'a is false',
      sites: [
        { file: 'libs/a.ts', line: 1 },
        { file: 'libs/b.ts', line: 2 },
      ],
      truncated: 0,
    },
  ],
};

test('a fully answered worklist is complete', () => {
  const report = checkAnswers(worklist, {
    head: 'abc',
    answers: [
      {
        id: 'an-obligation',
        site: worklist.selected[0].sites[0],
        answer: { a: 1, b: 2 },
      },
      {
        id: 'an-obligation',
        site: worklist.selected[0].sites[1],
        answer: { a: 1, b: 2 },
      },
    ],
  });
  assert.equal(report.complete, true);
  assert.equal(report.answered, 2);
  assert.equal(report.expected, 2);
});

test('an unanswered site is named, and completeness is false', () => {
  const report = checkAnswers(worklist, {
    head: 'abc',
    answers: [
      {
        id: 'an-obligation',
        site: worklist.selected[0].sites[0],
        answer: { a: 1, b: 2 },
      },
    ],
  });
  assert.equal(report.complete, false);
  assert.equal(report.unanswered.length, 1);
  assert.equal(report.unanswered[0].site.file, 'libs/b.ts');
});

test('a missing answer field is incomplete, not merely present', () => {
  const report = checkAnswers(worklist, {
    head: 'abc',
    answers: [
      {
        id: 'an-obligation',
        site: worklist.selected[0].sites[0],
        answer: { a: 1 },
      },
      {
        id: 'an-obligation',
        site: worklist.selected[0].sites[1],
        answer: { a: 1, b: null },
      },
    ],
  });
  assert.equal(report.complete, false);
  assert.deepEqual(
    report.incomplete.map((i) => i.missing),
    [['b'], ['b']],
  );
});

test('an answer for a site nobody asked about is reported, not counted', () => {
  const report = checkAnswers(worklist, {
    head: 'abc',
    answers: [
      {
        id: 'an-obligation',
        site: { file: 'libs/z.ts', line: 9 },
        answer: { a: 1, b: 2 },
      },
    ],
  });
  assert.equal(report.answered, 0);
  assert.equal(report.unexpected.length, 1);
});

test('an empty worklist is not "complete" — there was nothing to complete', () => {
  const report = checkAnswers(
    { head: 'abc', selected: [] },
    {
      head: 'abc',
      answers: [],
    },
  );
  assert.equal(report.expected, 0);
  assert.equal(report.complete, false);
});

test('a path may carry its own addedPattern, overriding the entry-level one', () => {
  // One entry often spans a value line and a whole generated directory. The
  // gate obligation shipped firing on ANY package.json edit because a single
  // entry-level pattern cannot say both things; the CI reviewer proved it on
  // this branch's own scripts-only edit.
  const cat = catalogue([
    obligation({
      trigger: {
        paths: [{ glob: 'package.json', addedPattern: 'needle' }, 'libs/**'],
      },
    }),
  ]);
  const fired = (diffText) =>
    selectObligations({
      catalogue: cat,
      addedLines: parseAddedLines(diffText),
      head: 'abc',
    }).selected;

  // The pattern gates package.json...
  assert.deepEqual(
    fired(diff('--- a/x', '+++ b/package.json', '@@ -0,0 +1,1 @@', '+chaff')),
    [],
  );
  assert.equal(
    fired(diff('--- a/x', '+++ b/package.json', '@@ -0,0 +1,1 @@', '+needle'))
      .length,
    1,
  );
  // ...and does not leak onto the bare glob beside it.
  assert.equal(
    fired(diff('--- a/x', '+++ b/libs/a.ts', '@@ -0,0 +1,1 @@', '+chaff'))
      .length,
    1,
  );
});

test('a path object is validated like any other trigger', () => {
  assert.throws(
    () =>
      assertObligationCatalogue(
        catalogue([obligation({ trigger: { paths: [{}] } })]),
      ),
    /needs a glob/,
  );
  assert.throws(
    () =>
      assertObligationCatalogue(
        catalogue([
          obligation({
            trigger: { paths: [{ glob: 'x', addedPattern: '(' }] },
          }),
        ]),
      ),
    /bad pattern/,
  );
});

test('the shipped catalogue is well-formed', () => {
  assert.ok(loadObligationCatalogue().obligations.length > 0);
});

// The point of the catalogue is that these four shapes stop depending on the
// reviewer noticing them. Each case below is the shape of the incident the
// entry was bought from; if the selector stops firing on it, the entry is
// dead and the golden case that scores it can only ever miss.
const ENV = 'process' + '.env.';

const fires = (id, diffText) => {
  const { selected } = selectObligations({
    catalogue: loadObligationCatalogue(),
    addedLines: parseAddedLines(diffText),
    head: 'abc',
  });
  return selected.some((o) => o.id === id);
};

test('#408: a version bump fires the gate obligation', () => {
  assert.ok(
    fires(
      'run-the-gate-that-covers-this-change',
      diff(
        '--- a/x',
        '+++ b/package.json',
        '@@ -3,1 +3,1 @@',
        '+  "version": "0.4.0",',
      ),
    ),
  );
});

test('#657: a bare window.confirm fires the destructive-confirmation obligation', () => {
  assert.ok(
    fires(
      'destructive-confirmation-names-what-it-mutates',
      diff(
        '--- a/x',
        '+++ b/apps/myorganizer/src/app/vault-export/page.tsx',
        '@@ -0,0 +88,1 @@',
        "+    if (!window.confirm('Importing will replace your current local vault data. Continue?')) return;",
      ),
    ),
  );
});

test('#525: a FormControl fires the slot obligation', () => {
  assert.ok(
    fires(
      'slot-injected-props-land-on-the-control',
      diff(
        '--- a/x',
        '+++ b/apps/myorganizer/src/app/(auth)/signup/page.tsx',
        '@@ -0,0 +40,2 @@',
        '+              <FormControl>',
        '+                <div className="relative">',
      ),
    ),
  );
});

test('#409: a process.env assignment fires the env obligation', () => {
  assert.ok(
    fires(
      'env-assignment-runtime-value',
      diff(
        '--- a/x',
        '+++ b/apps/backend/src/services/EmailService.spec.ts',
        '@@ -0,0 +12,1 @@',
        '+    process.env.MAIL_USERNAME = undefined;',
      ),
    ),
  );
});

test('#408: a package.json edit that is not a version bump does NOT fire', () => {
  // The boundary the reviewer found unverified, and the behaviour it should
  // have had: adding a yarn script is not a release.
  assert.ok(
    !fires(
      'run-the-gate-that-covers-this-change',
      diff(
        '--- a/x',
        '+++ b/package.json',
        '@@ -10,1 +10,1 @@',
        '+    "review:obligations:select": "node x.mjs",',
      ),
    ),
  );
});

test('#408: a generated output still fires without a version line', () => {
  assert.ok(
    fires(
      'run-the-gate-that-covers-this-change',
      diff(
        '--- a/x',
        '+++ b/libs/api-specs/src/api-specs.openapi.yaml',
        '@@ -1,1 +1,1 @@',
        '+  title: MyOrganizer',
      ),
    ),
  );
});

test('#409: a comparison is not an assignment and does not fire', () => {
  // The pattern ended at a bare `=`, which is also the first character of
  // `===`, so every ordinary read of an environment variable fired the
  // obligation. A trigger that fires everywhere teaches the reviewer to ignore
  // it, which is the failure the checklist exists to avoid.
  const READ = '+  if (' + ENV + "NODE_ENV === 'production') {";
  assert.ok(
    !fires(
      'env-assignment-runtime-value',
      diff('--- a/x', '+++ b/apps/a.ts', '@@ -0,0 +1,1 @@', READ),
    ),
  );
});

test('a diff touching none of those shapes fires nothing', () => {
  const { selected } = selectObligations({
    catalogue: loadObligationCatalogue(),
    addedLines: parseAddedLines(
      diff('--- a/x', '+++ b/docs/adr/0074-x.md', '@@ -0,0 +1,1 @@', '+prose'),
    ),
    head: 'abc',
  });
  assert.deepEqual(selected, []);
});
