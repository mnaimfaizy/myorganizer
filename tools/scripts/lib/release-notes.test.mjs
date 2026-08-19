import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyCommit,
  DEFAULT_NOTES_FILE,
  resolveNotesPlan,
  upsertChangelogSection,
} from './release-notes.mjs';

/**
 * A generated entry body carries its own `## Changes since ...` sub-heading at
 * the same heading level as the version heading. That collision is the source
 * of the v0.4.0 duplication, so every fixture here reproduces it.
 */
function entryFor(versionTag, previousTag, featureLine) {
  return [
    `## ${versionTag} - 2026-08-18`,
    '',
    'Date: 2026-08-18',
    '',
    `## Changes since ${previousTag}`,
    '',
    '### Features',
    `- ${featureLine}`,
  ].join('\n');
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('inserts a new section above the newest existing version', () => {
  const existing = [
    '# Changelog',
    '',
    '## v0.3.0 - 2026-08-03',
    '',
    'old body',
    '',
  ].join('\n');

  const result = upsertChangelogSection(existing, {
    versionTag: 'v0.4.0',
    entry: entryFor('v0.4.0', 'v0.3.0', 'new feature'),
  });

  assert.match(result, /^# Changelog/);
  assert.ok(
    result.indexOf('## v0.4.0') < result.indexOf('## v0.3.0'),
    'newest version must come first',
  );
  assert.ok(result.includes('old body'), 'existing sections are preserved');
});

test('replaces an existing section instead of duplicating its body', () => {
  const existing = [
    '# Changelog',
    '',
    entryFor('v0.4.0', 'v0.3.0', 'OLD feature'),
    '',
    '## v0.3.0 - 2026-08-03',
    '',
    'older body',
    '',
  ].join('\n');

  const result = upsertChangelogSection(existing, {
    versionTag: 'v0.4.0',
    entry: entryFor('v0.4.0', 'v0.3.0', 'NEW feature'),
  });

  // Regression: the old boundary regex stopped at `## Changes since`, so the
  // previous body survived and the entry appeared twice.
  assert.equal(countOccurrences(result, '## Changes since v0.3.0'), 1);
  assert.equal(countOccurrences(result, '## v0.4.0'), 1);
  assert.ok(!result.includes('OLD feature'), 'stale body must be removed');
  assert.ok(result.includes('NEW feature'));
  assert.ok(result.includes('older body'), 'later versions are untouched');
});

test('replaces a section that is the last one in the file', () => {
  // Regression: the old boundary stopped at the entry's own `## Changes since`
  // sub-heading, so the stale body survived even with nothing after it. The
  // intended end-of-input fallback could not save it either -- that alternative
  // was written `\Z`, which in JavaScript matches a literal "Z".
  const existing = [
    '# Changelog',
    '',
    entryFor('v0.1.0', 'v0.0.1', 'OLD feature'),
    '',
  ].join('\n');

  const result = upsertChangelogSection(existing, {
    versionTag: 'v0.1.0',
    entry: entryFor('v0.1.0', 'v0.0.1', 'NEW feature'),
  });

  assert.equal(countOccurrences(result, '## v0.1.0'), 1);
  assert.equal(countOccurrences(result, '## Changes since v0.0.1'), 1);
  assert.ok(!result.includes('OLD feature'));
});

test('is idempotent when applied twice', () => {
  const existing = [
    '# Changelog',
    '',
    '## v0.3.0 - 2026-08-03',
    '',
    'old body',
    '',
  ].join('\n');
  const entry = entryFor('v0.4.0', 'v0.3.0', 'new feature');

  const once = upsertChangelogSection(existing, {
    versionTag: 'v0.4.0',
    entry,
  });
  const twice = upsertChangelogSection(once, { versionTag: 'v0.4.0', entry });

  assert.equal(twice, once);
});

test('does not confuse a version with a longer prefix match', () => {
  const existing = [
    '# Changelog',
    '',
    '## v0.4.10 - 2026-09-01',
    '',
    'ten body',
    '',
    '## v0.4.1 - 2026-08-20',
    '',
    'one body',
    '',
  ].join('\n');

  const result = upsertChangelogSection(existing, {
    versionTag: 'v0.4.1',
    entry: entryFor('v0.4.1', 'v0.4.0', 'patched'),
  });

  assert.ok(result.includes('ten body'), 'v0.4.10 must not be overwritten');
  assert.ok(!result.includes('one body'), 'v0.4.1 body is replaced');
  assert.equal(countOccurrences(result, '## v0.4.10'), 1);
});

test('seeds the title when the changelog is empty', () => {
  const result = upsertChangelogSection('', {
    versionTag: 'v0.1.0',
    entry: entryFor('v0.1.0', 'v0.0.1', 'first'),
  });

  assert.match(result, /^# Changelog\n/);
  assert.ok(result.includes('## v0.1.0'));
  assert.ok(result.endsWith('\n'));
});

test('notes plan defaults to generated notes', () => {
  assert.deepEqual(resolveNotesPlan({}), {
    mode: 'generated',
    notesFile: null,
    notesFrom: null,
  });

  assert.deepEqual(resolveNotesPlan({ notesFile: 'RELEASE_NOTES.md' }), {
    mode: 'generated',
    notesFile: 'RELEASE_NOTES.md',
    notesFrom: null,
  });
});

test('notes plan gives authored prose a destination by default', () => {
  const plan = resolveNotesPlan({ notesFrom: '/tmp/draft.md' });

  assert.equal(plan.mode, 'authored');
  assert.equal(plan.notesFrom, '/tmp/draft.md');
  assert.equal(
    plan.notesFile,
    DEFAULT_NOTES_FILE,
    'authored notes must not be read and then discarded',
  );
});

test('notes plan honours an explicit destination for authored prose', () => {
  const plan = resolveNotesPlan({
    notesFrom: '/tmp/draft.md',
    notesFile: 'docs/NOTES.md',
  });

  assert.equal(plan.mode, 'authored');
  assert.equal(plan.notesFile, 'docs/NOTES.md');
});

test('notes plan rejects --no-notes combined with --notes-from', () => {
  const plan = resolveNotesPlan({
    notesFrom: '/tmp/draft.md',
    skipNotes: true,
  });

  assert.ok(plan.error, 'contradictory flags must not silently pick a winner');
  assert.match(plan.error, /--no-notes/);
  assert.match(plan.error, /--notes-from/);
  assert.equal(plan.mode, undefined);
});

test('notes plan skips notes entirely with --no-notes', () => {
  assert.deepEqual(resolveNotesPlan({ skipNotes: true }), {
    mode: 'none',
    notesFile: null,
    notesFrom: null,
  });

  // --notes-file alone is not enough to re-enable notes.
  assert.equal(
    resolveNotesPlan({ skipNotes: true, notesFile: 'RELEASE_NOTES.md' }).mode,
    'none',
  );
});

test('classifies conventional commit types', () => {
  assert.deepEqual(classifyCommit('feat(youtube): add queue rail', ''), {
    type: 'feat',
    scope: 'youtube',
    description: 'add queue rail',
    breaking: false,
  });

  assert.equal(classifyCommit('fix(deps): pin nanoid', '').type, 'fix');
  assert.equal(classifyCommit('feat!: drop legacy api', '').breaking, true);
  assert.equal(
    classifyCommit('refactor: reshape', 'BREAKING CHANGE: removed x').breaking,
    true,
  );
  assert.equal(classifyCommit('not a conventional subject', '').type, 'other');
});
