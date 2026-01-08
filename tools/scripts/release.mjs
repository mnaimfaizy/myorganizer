import { execSync } from 'node:child_process';
import fs from 'node:fs';

function assertNodeVersion() {
  const major = Number(String(process.versions.node).split('.')[0]);
  if (!Number.isFinite(major) || major < 22) {
    console.error(
      `Node.js v22+ is required to run this script. Current: ${process.versions.node}`
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

    if (token === '--tag') {
      args.tag = true;
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
      if (!next || next.startsWith('-')) {
        die('Missing value for --notes-file option.');
      }
      args.notesFile = next;
      i += 1;
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
      `Invalid version: "${input}". Expected semver like v1.2.3 or 1.2.3 (no prerelease).`
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
      'Working tree is not clean. Commit/stash your changes before releasing.'
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
      `Local ${branch} is not up to date with origin/${branch}. Run: git pull --ff-only`
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

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function listSemverTags() {
  const raw = run("git tag -l 'v[0-9]*.[0-9]*.[0-9]*'");
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => parseSemverTag(t) !== null);
}

function getPreviousSemverTag(currentTag) {
  const current = parseSemverTag(currentTag);
  if (!current) return null;

  const tags = listSemverTags();
  const prev = tags
    .map((t) => ({ tag: t, semver: parseSemverTag(t) }))
    .filter((x) => x.semver)
    .filter((x) => compareSemver(x.semver, current) < 0)
    .sort((a, b) => compareSemver(a.semver, b.semver));

  return prev.length ? prev[prev.length - 1].tag : null;
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

function classifyCommit(subject, body) {
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
    `git log --no-merges --pretty=format:%H%x1f%s%x1f%b%x1e ${logRange}`
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
  const heading = '# Changelog\n\n';

  const entry = generateChangelogEntryMarkdown({
    versionTag,
    previousTag,
  }).trimEnd();

  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
  } else {
    existing = heading;
  }

  if (!existing.trim()) {
    existing = heading;
  }

  if (!existing.startsWith('# Changelog')) {
    existing = `${heading}${existing.trimStart()}`;
  }

  // Replace existing section for this version if present; otherwise insert at top.
  // Section boundaries are "## vX.Y.Z" ... until next "## " or EOF.
  const escaped = String(versionTag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRe = new RegExp(
    `(^## ${escaped}\\b[\\s\\S]*?)(?=^## \\S|\\Z)`,
    'm'
  );

  let nextContent;
  if (sectionRe.test(existing)) {
    nextContent = existing.replace(sectionRe, `${entry}\n\n`);
  } else {
    // Insert right after the initial heading block.
    const firstEntryIdx = existing.indexOf('\n## ');
    if (firstEntryIdx === -1) {
      nextContent = `${existing.trimEnd()}\n\n${entry}\n`;
    } else {
      const head = existing.slice(0, firstEntryIdx).trimEnd();
      const rest = existing.slice(firstEntryIdx).trimStart();
      nextContent = `${head}\n\n${entry}\n\n${rest}\n`;
    }
  }

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
  node tools/scripts/release.mjs cut --version v1.2.3 [--push] [--tag] [--dry-run]
  node tools/scripts/release.mjs tag --version v1.2.3 [--push] [--dry-run]

What it does:
  cut:
    - checks clean working tree
    - ensures you are on main and up-to-date with origin/main
    - creates release branch: release/<version> (e.g. release/v1.2.3)
    - updates root package.json version to X.Y.Z and commits it (default)
      - use --no-version-bump to skip
    - optionally pushes the branch (with --push)
    - optionally creates + pushes the tag (with --tag --push)
    - updates CHANGELOG.md with generated notes and commits it (default)
      - use --no-notes to skip
      - use --notes-file <path> to also write the generated notes to a file
    - prints release notes to stdout if --notes-file is NOT provided
      - use --no-notes to skip
      - use --notes-file <path> to write notes to a file

  tag:
    - checks clean working tree
    - verifies you are on the release branch (release/<version>)
    - ensures root package.json version matches X.Y.Z and commits it (default)
      - use --no-version-bump to skip
    - creates an annotated tag vX.Y.Z (if not exists)
    - optionally pushes the tag (with --push)
    - updates CHANGELOG.md with generated notes and commits it (default)
      - use --no-notes to skip
      - use --notes-file <path> to also write the generated notes to a file
    - prints release notes to stdout if --notes-file is NOT provided
      - use --no-notes to skip
      - use --notes-file <path> to write notes to a file

Notes:
  - This script does NOT trigger GitHub Actions for you.
  - Production deploy is manual in GitHub Actions (Deploy Production workflow).`;

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
const previousTag = shouldGenerateNotes ? getPreviousSemverTag(version) : null;

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
    const addCmd = 'git add package.json CHANGELOG.md';
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

  if (args.tag) {
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
  }

  if (shouldGenerateNotes) {
    const notes = generateReleaseNotesMarkdown({
      versionTag: version,
      previousTag,
    });

    if (args.notesFile) {
      if (args.dryRun) {
        console.log(`[dry-run] write release notes -> ${args.notesFile}`);
      } else {
        fs.writeFileSync(args.notesFile, notes, 'utf8');
      }
      console.log(`\nRelease notes written to: ${args.notesFile}`);
    } else {
      console.log(`\n--- RELEASE NOTES (${version}) ---\n`);
      process.stdout.write(notes);
    }
  }

  console.log(`\nRelease branch ready: ${releaseBranch}`);
  console.log(
    'Next: run GitHub Actions → Deploy Production (manual) for this branch.'
  );
  process.exit(0);
}

// command === 'tag'
assertOnBranch(releaseBranch);
assertUpToDateWithOrigin(releaseBranch);

let didTagPreCommitChanges = false;

if (!args.skipVersionBump) {
  didTagPreCommitChanges =
    updateRootPackageJsonVersion(packageJsonVersion, {
      dryRun: args.dryRun,
    }) || didTagPreCommitChanges;
}

if (shouldGenerateNotes) {
  didTagPreCommitChanges =
    updateChangelogFile({
      versionTag: version,
      previousTag,
      dryRun: args.dryRun,
    }) || didTagPreCommitChanges;
}

if (didTagPreCommitChanges) {
  const addCmd = 'git add package.json CHANGELOG.md';
  const commitCmd = `git commit -m "chore(release): ${version}"`;

  if (args.dryRun) {
    console.log(`[dry-run] ${addCmd}`);
    console.log(`[dry-run] ${commitCmd}`);
  } else {
    runInherit(addCmd);
    runInherit(commitCmd);
  }
}

if (args.push && !args.dryRun) {
  // If we created a commit (version bump), make sure origin branch also advances.
  // This keeps the branch/tag aligned for CI/CD and traceability.
  runInherit(`git push origin ${releaseBranch}`);
}

if (shouldGenerateNotes) {
  const notes = generateReleaseNotesMarkdown({
    versionTag: version,
    previousTag,
  });

  if (args.notesFile) {
    if (args.dryRun) {
      console.log(`[dry-run] write release notes -> ${args.notesFile}`);
    } else {
      fs.writeFileSync(args.notesFile, notes, 'utf8');
    }
    console.log(`\nRelease notes written to: ${args.notesFile}`);
  } else {
    console.log(`\n--- RELEASE NOTES (${version}) ---\n`);
    process.stdout.write(notes);
  }
}

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
