/**
 * Pure helpers for release notes and CHANGELOG assembly.
 *
 * Kept free of `fs` and `git` so the assembly rules are unit-testable.
 * `tools/scripts/release.mjs` owns all side effects.
 */

export const CHANGELOG_TITLE = '# Changelog';

/**
 * Matches a CHANGELOG version heading: `## v1.2.3 - 2026-01-01`.
 *
 * Only version headings delimit a section. Generated entry bodies contain
 * their own `## Changes since vX.Y.Z` sub-heading at the same level, and
 * treating those as boundaries is what previously truncated a replacement
 * to the heading line and left the old body behind.
 */
const VERSION_HEADING_RE = /^## v\d+\.\d+\.\d+\b/;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function classifyCommit(subject, body) {
  const s = String(subject || '').trim();
  const b = String(body || '');

  const hasBreaking = /BREAKING CHANGE:/i.test(b);
  const m = /^([a-zA-Z]+)(\([^)]*\))?(!)?:\s+(.+)$/.exec(s);

  if (!m) {
    return {
      type: 'other',
      scope: null,
      description: s || '(no subject)',
      breaking: hasBreaking,
    };
  }

  const type = m[1].toLowerCase();
  const scope = m[2] ? m[2].slice(1, -1) : null;
  const bang = Boolean(m[3]);
  const description = m[4];

  return { type, scope, description, breaking: bang || hasBreaking };
}

/**
 * Insert or replace the `## <versionTag>` section of a CHANGELOG.
 *
 * A section runs from its version heading until the next version heading, or
 * to end of input when it is the last section. Replacing an existing section
 * is idempotent: running a release step twice yields the same file.
 *
 * @param {string} existingContent Current CHANGELOG.md contents (may be empty).
 * @param {{versionTag: string, entry: string}} params `entry` is the full
 *   section including its own `## <versionTag> - <date>` heading.
 * @returns {string} The updated CHANGELOG contents.
 */
export function upsertChangelogSection(existingContent, { versionTag, entry }) {
  if (!versionTag) throw new TypeError('versionTag is required');
  if (!entry) throw new TypeError('entry is required');

  const entryLines = entry.trimEnd().split(/\r?\n/);
  const sectionHeadingRe = new RegExp(`^## ${escapeRegExp(versionTag)}\\b`);

  let content = String(existingContent || '').trim();
  if (!content) content = CHANGELOG_TITLE;
  if (!content.startsWith(CHANGELOG_TITLE)) {
    content = `${CHANGELOG_TITLE}\n\n${content}`;
  }

  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => sectionHeadingRe.test(line));

  if (start !== -1) {
    // Replace through to the next version heading, or to end of file.
    let end = start + 1;
    while (end < lines.length && !VERSION_HEADING_RE.test(lines[end])) {
      end += 1;
    }

    const before = lines.slice(0, start);
    const after = lines.slice(end);
    const next =
      after.length > 0
        ? [...before, ...entryLines, '', ...after]
        : [...before, ...entryLines];

    return `${next.join('\n').trimEnd()}\n`;
  }

  // No section for this version yet: insert above the newest existing one.
  const firstVersionIdx = lines.findIndex((line) =>
    VERSION_HEADING_RE.test(line),
  );

  if (firstVersionIdx === -1) {
    return `${[...lines, '', ...entryLines].join('\n').trim()}\n`;
  }

  const head = lines.slice(0, firstVersionIdx);
  const rest = lines.slice(firstVersionIdx);

  while (head.length > 0 && head[head.length - 1].trim() === '') head.pop();

  return `${[...head, '', ...entryLines, '', ...rest].join('\n').trimEnd()}\n`;
}
