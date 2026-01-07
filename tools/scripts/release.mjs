import { execSync } from 'node:child_process';

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

    if (token.startsWith('--version=')) {
      args.version = token.slice('--version='.length);
      continue;
    }

    if (token === '--version') {
      args.version = argv[i + 1];
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

function printHelp() {
  console.log(
    `\nRelease helper (git automation)\n\nUsage:\n  node tools/scripts/release.mjs cut --version v1.2.3 [--push] [--tag] [--dry-run]\n  node tools/scripts/release.mjs tag --version v1.2.3 [--push] [--dry-run]\n\nWhat it does:\n  cut:\n    - checks clean working tree\n    - ensures you are on main and up-to-date with origin/main\n    - creates release branch: release/<version> (e.g. release/v1.2.3)\n    - optionally pushes the branch (with --push)\n    - optionally creates + pushes the tag (with --tag --push)\n\n  tag:\n    - checks clean working tree\n    - creates an annotated tag vX.Y.Z (if not exists)\n    - optionally pushes the tag (with --push)\n\nNotes:\n  - This script does NOT trigger GitHub Actions for you.\n  - Production deploy is manual in GitHub Actions (Deploy Production workflow).\n`
  );
}

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

  console.log(`\nRelease branch ready: ${releaseBranch}`);
  console.log(
    'Next: run GitHub Actions → Deploy Production (manual) for this branch.'
  );
  process.exit(0);
}

// command === 'tag'
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
