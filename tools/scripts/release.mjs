import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  classifyCommit,
  upsertChangelogSection,
} from './lib/release-notes.mjs';

function assertNodeVersion() {
  const major = Number(String(process.versions.node).split('.')[0]);
  if (!Number.isFinite(major) || major < 22) {
    console.error(
      `Node.js v22+ is required to run this script. Current: ${process.versions.node}`,
    );
    process.exit(1);
  }
}

function run(command, options = {}) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
    .toString('utf8')
    .trim();
}

function runInherit(command) {
  execSync(command, { stdio: 'inherit' });
}

function quoteShellArg(value) {
  const v = String(value);
  // Minimal, cross-platform-friendly quoting for paths/args.
  // Wrap in double quotes and escape internal double quotes.
  return `"${v.replaceAll('"', '\\"')}"`;
}

function ensureParentDirExists(filePath, { dryRun }) {
  const dir = path.dirname(filePath);
  if (!dir || dir === '.' || dir === filePath) return;

  if (dryRun) return;
  fs.mkdirSync(dir, { recursive: true });
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--push') {
      args.push = true;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--no-version-bump' || token === '--skip-version-bump') {
      args.skipVersionBump = true;
      continue;
    }

    if (token === '--no-notes' || token === '--skip-notes') {
      args.skipNotes = true;
      continue;
    }

    if (token.startsWith('--notes-file=')) {
      args.notesFile = token.slice('--notes-file='.length);
      continue;
    }

    if (token === '--notes-file') {
      const next = argv[i + 1];
      // Allow "--notes-file" without a value to default to a rolling file.
      if (!next || next.startsWith('-')) {
        args.notesFile = 'RELEASE_NOTES.md';
      } else {
        args.notesFile = next;
        i += 1;
      }
      continue;
    }

    if (token.startsWith('--version=')) {
      args.version = token.slice('--version='.length);
      continue;
    }

    if (token === '--version') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        die('Missing value for --version option.');
      }
      args.version = next;
      i += 1;
      continue;
    }

    args._.push(token);
  }

  return args;
}

function normalizeVersion(input) {
  if (!input) return undefined;

  const v = String(input).trim();
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!match) {
    die(
      `Invalid version: "${input}". Expected semver like v1.2.3 or 1.2.3 (no prerelease).`,
    );
  }

  return `v${match[1]}.${match[2]}.${match[3]}`;
}

function toPackageJsonVersion(tagVersion) {
  // v1.2.3 -> 1.2.3
  return String(tagVersion).startsWith('v')
    ? String(tagVersion).slice(1)
    : String(tagVersion);
}

function readRootPackageJsonVersion() {
  const json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!json || typeof json !== 'object') {
    die('Failed to parse package.json');
  }
  return json.version;
}

function assertPackageJsonVersionMatches(expectedVersion) {
  const actual = readRootPackageJsonVersion();
  if (actual !== expectedVersion) {
    die(
      `package.json version is ${actual}, expected ${expectedVersion}. ` +
        'Run `release:cut` first, or check out the release branch.',
    );
  }
}

function updateRootPackageJsonVersion(nextVersion, { dryRun }) {
  const filePath = 'package.json';
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);

  if (!json || typeof json !== 'object') {
    die('Failed to parse package.json');
  }

  if (json.version === nextVersion) {
    return false;
  }

  json.version = nextVersion;

  const nextContent = `${JSON.stringify(json, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] update ${filePath} version -> ${nextVersion}`);
    return true;
  }

  fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function getCurrentBranch() {
  return run('git rev-parse --abbrev-ref HEAD');
}

function assertCleanTree() {
  const porcelain = run('git status --porcelain');
  if (porcelain.length > 0) {
    die(
      'Working tree is not clean. Commit/stash your changes before releasing.',
    );
  }
}

function assertOnBranch(expected) {
  const current = getCurrentBranch();
  if (current !== expected) {
    die(`Expected to be on branch "${expected}", but you are on "${current}".`);
  }
}

function assertUpToDateWithOrigin(branch) {
  runInherit('git fetch origin --prune');

  const local = run(`git rev-parse ${branch}`);
  const remote = run(`git rev-parse origin/${branch}`);

  if (local !== remote) {
    die(
      `Local ${branch} is not up to date with origin/${branch}. Run: git pull --ff-only`,
    );
  }
}

function branchExists(branchName) {
  try {
    run(`git rev-parse --verify ${branchName}`);
    return true;
  } catch {
    return false;
  }
}

function tagExists(tagName) {
  try {
    run(`git rev-parse --verify refs/tags/${tagName}`);
    return true;
  } catch {
    return false;
  }
}

function parseSemverTag(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(String(tag));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getLatestReachableSemverTag({ excludeTag } = {}) {
  // Find the most recent semver tag that is reachable from HEAD.
  // Prefer semantic sort (highest version) then verify ancestry.
  // This avoids relying on GitHub releases or fragile shell quoting.
  const raw = run('git tag -l "v[0-9]*.[0-9]*.[0-9]*" --sort=-v:refname');
  if (!raw) return null;

  const tags = raw
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => parseSemverTag(t) !== null)
    .filter((t) => !excludeTag || t !== excludeTag);

  for (const t of tags) {
    try {
      run(`git merge-base --is-ancestor ${t} HEAD`);
      return t;
    } catch {
      // Not reachable from current HEAD; skip.
    }
  }

  return null;
}

function normalizeNotesFilePath(notesFile) {
  if (!notesFile) return notesFile;

  // Discourage accumulating versioned release notes files.
  // Prefer a single rolling file since CHANGELOG.md is the source of truth.
  if (/^release-notes-v\d+\.\d+\.\d+\.md$/i.test(path.basename(notesFile))) {
    return 'RELEASE_NOTES.md';
  }

  return notesFile;
}

function getGitHubRepoSlugFromRemote() {
  try {
    const url = run('git config --get remote.origin.url');
    if (!url) return null;

    // https://github.com/owner/repo.git
    const httpsMatch =
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
    if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;

    // git@github.com:owner/repo.git
    const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
    if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

    return null;
  } catch {
    return null;
  }
}

function generateReleaseNotesMarkdown({ versionTag, previousTag }) {
  const slug = getGitHubRepoSlugFromRemote();
  const title = `# Release ${versionTag}`;
  const date = new Date().toISOString().slice(0, 10);

  let rangeLabel = 'Initial release';
  let compareUrl = null;

  if (previousTag) {
    rangeLabel = `Changes since ${previousTag}`;
    if (slug) {
      compareUrl = `https://github.com/${slug}/compare/${previousTag}...${versionTag}`;
    }
  }

  const logRange = previousTag ? `${previousTag}..HEAD` : 'HEAD';

  const raw = run(
    `git log --no-merges --pretty=format:%H%x1f%s%x1f%b%x1e ${logRange}`,
  );

  const entries = raw
    ? raw
        .split('\x1e')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [hash, subject, body] = chunk.split('\x1f');
          return { hash, subject, body };
        })
    : [];

  const sections = {
    breaking: [],
    feat: [],
    fix: [],
    perf: [],
    docs: [],
    refactor: [],
    test: [],
    ci: [],
    chore: [],
    other: [],
  };

  for (const e of entries) {
    const c = classifyCommit(e.subject, e.body);
    const short = String(e.hash || '').slice(0, 7);
    const scope = c.scope ? `**${c.scope}**: ` : '';
    const line = `- ${scope}${c.description} (${short})`;

    if (c.breaking) {
      sections.breaking.push(line);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(sections, c.type)) {
      sections[c.type].push(line);
    } else {
      sections.other.push(line);
    }
  }

  const lines = [title, '', `Date: ${date}`, '', `## ${rangeLabel}`];

  if (compareUrl) {
    lines.push('', `Compare: ${compareUrl}`);
  }

  const addSection = (heading, arr) => {
    if (!arr.length) return;
    lines.push('', `### ${heading}`, ...arr);
  };

  addSection('Breaking changes', sections.breaking);
  addSection('Features', sections.feat);
  addSection('Fixes', sections.fix);
  addSection('Performance', sections.perf);
  addSection('Documentation', sections.docs);
  addSection('Refactors', sections.refactor);
  addSection('Tests', sections.test);
  addSection('CI', sections.ci);
  addSection('Chores', sections.chore);
  addSection('Other changes', sections.other);

  if (!entries.length) {
    lines.push('', '_No changes detected in git log range._');
  }

  return `${lines.join('\n')}\n`;
}

function generateChangelogEntryMarkdown({ versionTag, previousTag }) {
  const fullNotes = generateReleaseNotesMarkdown({ versionTag, previousTag });

  // Convert "# Release vX.Y.Z" -> "## vX.Y.Z - YYYY-MM-DD" (Keep it simple)
  // Strip the first title line and reuse the remaining sections.
  const date = new Date().toISOString().slice(0, 10);
  const lines = fullNotes.split(/\r?\n/);
  const withoutTitle = lines.slice(1).join('\n').trim();
  return `## ${versionTag} - ${date}\n\n${withoutTitle}\n`;
}

function updateChangelogFile({ versionTag, previousTag, dryRun }) {
  const filePath = 'CHANGELOG.md';

  const entry = generateChangelogEntryMarkdown({
    versionTag,
    previousTag,
  }).trimEnd();

  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : '';

  const nextContent = upsertChangelogSection(existing, { versionTag, entry });

  if (dryRun) {
    console.log(`[dry-run] update ${filePath} for ${versionTag}`);
    return true;
  }

  fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function printHelp() {
  const HELP_TEXT = `Release helper (git automation)

Usage:
  node tools/scripts/release.mjs cut --version v1.2.3 [--push] [--dry-run]
  node tools/scripts/release.mjs tag --version v1.2.3 [--push] [--dry-run]

What it does:
  cut:
    - checks clean working tree
    - ensures you are on main and up-to-date with origin/main
    - creates release branch: release/<version> (e.g. release/v1.2.3)
    - updates root package.json version to X.Y.Z and commits it (default)
      - use --no-version-bump to skip
    - optionally pushes the branch (with --push)
    - updates CHANGELOG.md with generated notes and commits it (default)
      - use --no-notes to skip
      - use --notes-file <path> to also write the generated notes to a file
    - prints release notes to stdout if --notes-file is NOT provided
      - use --no-notes to skip
      - use --notes-file <path> to write notes to a file

  tag:
    - checks clean working tree
    - verifies you are on the release branch (release/<version>)
    - verifies local release branch is in sync with origin
    - verifies root package.json version already matches X.Y.Z
    - creates an annotated tag vX.Y.Z (if not exists)
    - optionally pushes the tag (with --push)

    tag never writes files or creates commits. Run it only after the
    production deploy succeeds: the tag records which commit went live, so
    it must name the exact SHA that CI verified and a reviewer approved.
    --no-notes, --notes-file, and --no-version-bump apply to cut only.

Notes:
  - This script does NOT trigger GitHub Actions for you.
  - Production deploys require required-reviewer approval on the 'production'
    GitHub Environment. See docs/adr/0028-*.md.`;

  console.log(`\n${HELP_TEXT}`);
}

assertNodeVersion();

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const command = args._[0];
const version = normalizeVersion(args.version);

if (!command || (command !== 'cut' && command !== 'tag')) {
  printHelp();
  die('Missing command. Use: cut or tag');
}

if (!version) {
  die('Missing --version. Example: --version v1.2.3');
}

const releaseBranch = `release/${version}`;
const packageJsonVersion = toPackageJsonVersion(version);
const shouldGenerateNotes = !args.skipNotes;
args.notesFile = normalizeNotesFilePath(args.notesFile);
const previousTag = shouldGenerateNotes
  ? getLatestReachableSemverTag({ excludeTag: version })
  : null;

assertCleanTree();

if (command === 'cut') {
  assertOnBranch('main');
  assertUpToDateWithOrigin('main');

  if (branchExists(releaseBranch)) {
    die(`Branch already exists: ${releaseBranch}`);
  }

  const createBranchCmd = `git checkout -b ${releaseBranch}`;
  if (args.dryRun) {
    console.log(`[dry-run] ${createBranchCmd}`);
  } else {
    runInherit(createBranchCmd);
  }

  let didChangeFiles = false;

  let notes = null;
  if (shouldGenerateNotes) {
    notes = generateReleaseNotesMarkdown({
      versionTag: version,
      previousTag,
    });

    if (args.notesFile) {
      ensureParentDirExists(args.notesFile, { dryRun: args.dryRun });
      if (args.dryRun) {
        console.log(`[dry-run] write release notes -> ${args.notesFile}`);
      } else {
        fs.writeFileSync(args.notesFile, notes, 'utf8');
      }
      didChangeFiles = true;
    }
  }

  if (!args.skipVersionBump) {
    didChangeFiles =
      updateRootPackageJsonVersion(packageJsonVersion, {
        dryRun: args.dryRun,
      }) || didChangeFiles;
  }

  if (shouldGenerateNotes) {
    didChangeFiles =
      updateChangelogFile({
        versionTag: version,
        previousTag,
        dryRun: args.dryRun,
      }) || didChangeFiles;
  }

  if (didChangeFiles) {
    const filesToAdd = ['package.json', 'CHANGELOG.md'];
    if (args.notesFile) {
      filesToAdd.push(args.notesFile);
    }
    const addCmd = `git add ${filesToAdd.map(quoteShellArg).join(' ')}`;
    const commitCmd = `git commit -m "chore(release): ${version}"`;

    if (args.dryRun) {
      console.log(`[dry-run] ${addCmd}`);
      console.log(`[dry-run] ${commitCmd}`);
    } else {
      runInherit(addCmd);
      runInherit(commitCmd);
    }
  }

  if (args.push) {
    const pushCmd = `git push -u origin ${releaseBranch}`;
    if (args.dryRun) {
      console.log(`[dry-run] ${pushCmd}`);
    } else {
      runInherit(pushCmd);
    }
  } else {
    console.log(`Next: git push -u origin ${releaseBranch}`);
  }

  if (shouldGenerateNotes) {
    if (args.notesFile) {
      console.log(`\nRelease notes written to: ${args.notesFile}`);
    } else {
      console.log(`\n--- RELEASE NOTES (${version}) ---\n`);
      process.stdout.write(notes);
    }
  }

  console.log(`\nRelease branch ready: ${releaseBranch}`);
  console.log(
    'Next: run GitHub Actions → Deploy Production (manual) for this branch.',
  );
  process.exit(0);
}

// command === 'tag'
//
// Tagging is a receipt, not a build step: the tag records that this version
// reached production (ADR 0028). It must not write files or create commits.
// Notes, the version bump, and the CHANGELOG entry all belong to `cut` -- a
// commit created here would move the branch past the exact SHA that CI
// verified and a reviewer approved, so the tag would name a commit that was
// never deployed.
assertOnBranch(releaseBranch);
assertUpToDateWithOrigin(releaseBranch);
assertPackageJsonVersionMatches(packageJsonVersion);

if (tagExists(version)) {
  die(`Tag already exists: ${version}`);
}

const tagCmd = `git tag -a ${version} -m "Release ${version}"`;
if (args.dryRun) {
  console.log(`[dry-run] ${tagCmd}`);
} else {
  runInherit(tagCmd);
}

if (args.push) {
  const pushTagCmd = `git push origin ${version}`;
  if (args.dryRun) {
    console.log(`[dry-run] ${pushTagCmd}`);
  } else {
    runInherit(pushTagCmd);
  }
} else {
  console.log(`Next: git push origin ${version}`);
}
