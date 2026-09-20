/**
 * Shared filesystem vocabulary for Markdown assertion gates.
 *
 * These helpers deliberately stop at mechanics: which top-level roots anchor a
 * repository path, how tracked Markdown is listed, and how gitignored paths are
 * batched. Each checker still owns the semantic question of which Markdown
 * tokens constitute claims.
 */
import { execFileSync, spawnSync } from 'node:child_process';

export const REPO_PATH_ROOTS = [
  '.agents/',
  '.claude/',
  '.cursor/',
  '.github/',
  '.husky/',
  'apps/',
  'docs/',
  'libs/',
  'tools/',
];

export const hasPathPlaceholder = (token) => /[<>${}*?|!]/.test(token);

/** Strip punctuation a path token picks up in shell or prose. */
export function cleanRepoPathToken(token) {
  return token.replace(/^[('"`]+/, '').replace(/[)'"`,;:.]+$/, '');
}

/**
 * Does a token start at a known repository root?
 *
 * `allowDcHtml` preserves the documented-command checker's historical
 * rootless design-export claim. `strict` is for prose file-refs, where spaces
 * and ellipses identify examples rather than concrete repository paths.
 */
export function isRepoPathToken(
  token,
  { allowDcHtml = false, strict = false } = {},
) {
  if (!token || hasPathPlaceholder(token)) return false;
  if (
    strict &&
    (/\s/.test(token) || token.includes('…') || token.includes('...'))
  ) {
    return false;
  }
  return (
    REPO_PATH_ROOTS.some((root) => token.startsWith(root)) ||
    (allowDcHtml && token.endsWith('.dc.html'))
  );
}

export const createCheckerFail = (prefix) => (message) => {
  console.error(`${prefix}: ${message}`);
  process.exit(2);
};

/**
 * Return the input paths git ignores.
 *
 * A missing ignored directory may only match with a trailing slash. The
 * `includeDirectoryCandidates` mode checks both spellings and normalizes the
 * result back to the caller's slashless claim.
 */
export function gitIgnoredPaths(
  paths,
  { cwd = process.cwd(), fail, includeDirectoryCandidates = false } = {},
) {
  if (paths.length === 0) return new Set();
  const candidates = includeDirectoryCandidates
    ? [
        ...new Set(
          paths.flatMap((path) =>
            path.endsWith('/') ? [path] : [path, `${path}/`],
          ),
        ),
      ]
    : paths;
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd,
    input: candidates.join('\n'),
    encoding: 'utf8',
  });
  if (result.error) {
    fail(`could not run git check-ignore: ${result.error.message}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    fail(`git check-ignore exited ${result.status}`);
  }
  const ignored = (result.stdout ?? '').split('\n').filter(Boolean);
  return new Set(
    includeDirectoryCandidates
      ? ignored.map((path) => path.replace(/\/+$/, ''))
      : ignored,
  );
}

export function listTrackedMarkdown({ cwd = process.cwd(), fail } = {}) {
  try {
    return execFileSync('git', ['ls-files', '*.md'], {
      cwd,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return fail(
      'could not list tracked Markdown files — is this a git repository?',
    );
  }
}
