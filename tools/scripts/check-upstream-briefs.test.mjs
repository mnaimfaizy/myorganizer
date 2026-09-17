/**
 * Contract suite for `check-upstream-briefs.mjs` (ADR 0085: the header is the
 * specification, this is what makes it true).
 *
 * The header claims one direction — every committed structured report's
 * surviving entries still hold at the commit it records — and claims three
 * things it deliberately does not assert: an unpaired Markdown brief, a
 * missing report, and the report's own write-time Unverified list. Each of
 * those is proved here too, because an omission nobody tests is indistinguish-
 * able from an omission nobody noticed.
 *
 * Every input is injected, so nothing here reads this repository or its
 * history: the checker's own git plumbing is the one part that does, and it is
 * three lines of `execFileSync` either side of this seam.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BRIEF_DIR,
  checkUpstreamBriefs,
  resolveBriefDir,
} from './check-upstream-briefs.mjs';
import { normalizeUpstreamReport } from '../../.agents/skills/upstream-brief/report.mjs';

const SKILL = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.agents',
  'skills',
  'upstream-brief',
);
const TREE = join(SKILL, 'fixtures', 'tree');

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

const treeReader = (file) => {
  try {
    return readFileSync(join(TREE, file), 'utf8');
  } catch {
    return null;
  }
};

const fixtureReport = () =>
  JSON.parse(readFileSync(join(SKILL, 'fixtures', 'report.json'), 'utf8'));

/** The committed artifact: the validator's output, not the worker's input. */
const committedReport = (mutate) => {
  const raw = fixtureReport();
  if (mutate) mutate(raw);
  return normalizeUpstreamReport(raw, { readSource: treeReader });
};

/**
 * A repository made of a file map. `files` is path → contents; anything else
 * reads as absent, which is how "the brief directory does not exist" is
 * expressed.
 */
const repo = (
  files,
  { dirs = {}, commits = [COMMIT], source = treeReader } = {},
) =>
  checkUpstreamBriefs({
    read: (path) => files[path] ?? null,
    list: (dir) => dirs[dir] ?? null,
    hasCommit: (commit) => commits.includes(commit),
    source: () => source,
  });

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// ── Where the reports are ───────────────────────────────────────────────────

test('the brief directory comes from the adapter', () => {
  assert.equal(
    resolveBriefDir((p) =>
      p === 'upstream-brief.config.yml' ? 'brief_dir: docs/upstream\n' : null,
    ),
    'docs/upstream',
  );
});

test('a quoted or trailing-commented brief_dir still resolves', () => {
  assert.equal(
    resolveBriefDir(() => "brief_dir: 'docs/x' # where briefs go\n"),
    'docs/x',
  );
});

test('a JSON adapter is parsed rather than matched', () => {
  assert.equal(
    resolveBriefDir((p) =>
      p === 'upstream-brief.config.json' ? '{"brief_dir": "docs/j"}' : null,
    ),
    'docs/j',
  );
});

test('no adapter, or one that declares no brief_dir, falls back to the documented default', () => {
  assert.equal(
    resolveBriefDir(() => null),
    DEFAULT_BRIEF_DIR,
  );
  assert.equal(
    resolveBriefDir(() => 'instruction_globs:\n  - AGENTS.md\n'),
    DEFAULT_BRIEF_DIR,
  );
});

test('this repository resolves to the directory its own adapter names', () => {
  // The one assertion that reads the real tree: a checker pointed at the
  // wrong directory passes forever while checking nothing.
  const config = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'upstream-brief.config.yml',
    ),
    'utf8',
  );
  assert.equal(
    resolveBriefDir((p) => (p === 'upstream-brief.config.yml' ? config : null)),
    'docs/research',
  );
});

// ── Passing when there is nothing to check ──────────────────────────────────

test('a brief directory that does not exist passes and says so', () => {
  const result = repo({});
  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join('\n'), /does not exist/);
});

test('a brief directory with no structured report passes and says so', () => {
  // The three briefs written before ADR 0084 are not migrated, so this is the
  // state the gate ships in. A green run that checked nothing must not read
  // like a green run that checked everything.
  const result = repo(
    {},
    { dirs: { 'docs/research': ['2026-08-16-upstream-brief-next.md'] } },
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.reports, []);
  assert.match(result.lines.join('\n'), /nothing to re-validate/);
});

test('a Markdown brief with no report beside it is not a failure', () => {
  const result = repo(
    {},
    {
      dirs: {
        'docs/research': [
          '2026-08-16-upstream-brief-next.md',
          '2026-08-21-upstream-brief-nx.md',
          '2026-08-24-upstream-brief-react-native.md',
        ],
      },
    },
  );
  assert.equal(result.exitCode, 0);
});

// ── The direction it does assert ────────────────────────────────────────────

test('a committed report whose evidence still holds passes', () => {
  const result = repo(
    {
      'docs/research/2026-09-17-upstream-brief-next-nx.json':
        json(committedReport()),
    },
    { dirs: { 'docs/research': ['2026-09-17-upstream-brief-next-nx.json'] } },
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.reports, [
    {
      path: 'docs/research/2026-09-17-upstream-brief-next-nx.json',
      commit: COMMIT,
      ok: true,
    },
  ]);
});

test('a committed report whose local evidence no longer matches its commit fails', () => {
  const drifted = (file) =>
    file === 'instructions.md'
      ? '# Example instruction file\n'
      : treeReader(file);

  const result = repo(
    { 'docs/research/brief.json': json(committedReport()) },
    { dirs: { 'docs/research': ['brief.json'] }, source: drifted },
  );

  assert.equal(result.exitCode, 1);
  const output = result.lines.join('\n');
  assert.match(output, /no longer holds at 0123456789/);
  assert.match(output, /line-out-of-range|text-differs/);
});

test("the report's own write-time Unverified list is carried, never re-checked", () => {
  const report = committedReport((raw) => {
    delete raw.ecosystems[0].findings[0].source.url;
  });
  assert.equal(report.unverified.length, 1);

  const result = repo(
    { 'docs/research/brief.json': json(report) },
    { dirs: { 'docs/research': ['brief.json'] } },
  );
  assert.equal(result.exitCode, 0);
});

test('a report committed without being validated is refused', () => {
  const result = repo(
    { 'docs/research/brief.json': json(fixtureReport()) },
    { dirs: { 'docs/research': ['brief.json'] } },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join('\n'), /not a normalized report/);
});

test('counts that disagree with the entries they count fail', () => {
  const report = committedReport();
  report.counts.opportunities = 99;
  const result = repo(
    { 'docs/research/brief.json': json(report) },
    { dirs: { 'docs/research': ['brief.json'] } },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join('\n'), /counts\.opportunities/);
});

test('every report in the directory is checked, not just the first failure', () => {
  const good = json(committedReport());
  const bad = json(fixtureReport());
  const result = repo(
    {
      'docs/research/a.json': bad,
      'docs/research/b.json': good,
      'docs/research/c.json': bad,
    },
    { dirs: { 'docs/research': ['c.json', 'a.json', 'b.json'] } },
  );
  assert.equal(result.exitCode, 1);
  // Sorted, so the log reads the same on every filesystem.
  assert.match(result.lines[0], /docs\/research\/a\.json/);
  assert.equal(
    result.lines.filter((line) =>
      /is not a normalized report|not a normalized/.test(line),
    ).length,
    2,
  );
});

// ── Could not run, told apart from drift ────────────────────────────────────

test('a recorded commit this clone does not have is exit 2, not a fabrication', () => {
  // `git show` fails identically for a missing path and an unresolvable ref.
  // Without resolving the commit first, a shallow clone would report every
  // citation in the brief as citing a file that is not in the tree.
  const result = repo(
    { 'docs/research/brief.json': json(committedReport()) },
    { dirs: { 'docs/research': ['brief.json'] }, commits: [] },
  );
  assert.equal(result.exitCode, 2);
  assert.match(result.lines.join('\n'), /not in this clone/);
  assert.ok(!result.lines.join('\n').includes('file-not-found'));
});

test('a report that is not JSON is invalid, not unrunnable', () => {
  const result = repo(
    { 'docs/research/brief.json': '{ nope' },
    { dirs: { 'docs/research': ['brief.json'] } },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join('\n'), /not valid JSON/);
});

test('a report recording no commit is invalid', () => {
  const report = committedReport();
  delete report.commit;
  const result = repo(
    { 'docs/research/brief.json': json(report) },
    { dirs: { 'docs/research': ['brief.json'] } },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join('\n'), /records no commit/);
});

test('an unreadable report is exit 2, and the worst code across reports wins', () => {
  const result = repo(
    { 'docs/research/b.json': '{ nope' },
    { dirs: { 'docs/research': ['a.json', 'b.json'] } },
  );
  assert.equal(result.exitCode, 2);
  assert.match(result.lines.join('\n'), /a\.json could not be read/);
  assert.match(result.lines.join('\n'), /b\.json is not valid JSON/);
});

test('a non-JSON file in the brief directory is not treated as a report', () => {
  const result = repo(
    {},
    {
      dirs: {
        'docs/research': ['2026-08-16-upstream-brief-next.md', 'notes.txt'],
      },
    },
  );
  assert.equal(result.exitCode, 0);
});
