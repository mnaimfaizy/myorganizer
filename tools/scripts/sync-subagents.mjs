#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const CANONICAL_DIR = path.join(repoRoot, '.github', 'agents');
const MODEL_POLICY_PATH = path.join(
  repoRoot,
  'tools',
  'config',
  'agent-model-policy.json',
);
const MODEL_POLICY = JSON.parse(await fs.readFile(MODEL_POLICY_PATH, 'utf8'));

const HARNESS_CONFIG = {
  claude: {
    dir: path.join(repoRoot, '.claude', 'agents'),
    extension: '.md',
    defaultTools: '[Read, Glob, Grep, Edit, Write, Bash]',
    nameTransform: (name) => name,
  },
  cursor: {
    dir: path.join(repoRoot, '.cursor', 'agents'),
    extension: '.md',
    nameTransform: (name) => name,
  },
  gemini: {
    dir: path.join(repoRoot, '.gemini', 'agents'),
    extension: '.md',
    defaultTools: [
      'read_file',
      'list_files',
      'search_files',
      'replace_in_file',
      'write_file',
      'run_shell_command',
    ],
    nameTransform: (name, slug) => {
      if (slug === 'explore') return 'code-explorer';
      return toKebab(name);
    },
  },
};

const USAGE = `Usage:\n  node tools/scripts/sync-subagents.mjs --check\n  node tools/scripts/sync-subagents.mjs --apply [--no-prune]\n\nNotes:\n  - Canonical source is .github/agents/*.agent.md\n  - Existing target frontmatter is always preserved verbatim; only the body is synced.\n    Harness defaults (including tools:) apply ONLY when creating a new file.\n  - A target whose frontmatter cannot be parsed is reported as malformed and skipped,\n    never rewritten, so per-agent tools: grants cannot be silently widened.\n  - Missing target files are created with harness-specific defaults.\n  - --apply prunes extra files by default (disable with --no-prune).\n`;

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const mode = args.has('--apply')
    ? 'apply'
    : args.has('--check')
      ? 'check'
      : null;
  const prune = mode === 'apply' ? !args.has('--no-prune') : false;
  if (!mode) {
    throw new Error(USAGE);
  }
  return { mode, prune };
}

function toKebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function splitFrontmatter(content) {
  // Normalize line endings first. Matching '\n---\n' against a CRLF file used to
  // report "no frontmatter", which made the caller regenerate frontmatter from
  // harness defaults and silently overwrite hand-tuned `tools:` grants.
  const normalized = content.replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return { frontmatter: null, body: normalized.replace(/^\s+/, '') };
  }

  const closeIdx = normalized.indexOf('\n---\n', 4);
  if (closeIdx === -1) {
    return { frontmatter: null, body: normalized.replace(/^\s+/, '') };
  }

  const frontmatter = normalized.slice(0, closeIdx + 5);
  const body = normalized.slice(closeIdx + 5).replace(/^\s+/, '');
  return { frontmatter, body };
}

function parseCanonicalMeta(frontmatter, fallbackSlug) {
  const nameMatch = frontmatter.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
  const name = nameMatch?.[1]?.trim() || fallbackSlug;
  const description =
    descMatch?.[1]?.trim() || `Canonical agent for ${fallbackSlug}`;
  return { name, description };
}

function normalizeBody(body) {
  return body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
}

function buildFrontmatter(harness, slug, canonicalMeta) {
  const cfg = HARNESS_CONFIG[harness];
  const name = cfg.nameTransform(canonicalMeta.name, slug);
  const model = MODEL_POLICY.agents?.[slug]?.models?.[harness];
  if (!model || Array.isArray(model)) {
    throw new Error(
      `Missing single-model ${harness} assignment for ${slug} in ${MODEL_POLICY_PATH}`,
    );
  }
  const description = canonicalMeta.description.replace(/\s+/g, ' ').trim();

  if (harness === 'gemini') {
    const tools = cfg.defaultTools.map((tool) => `  - ${tool}`).join('\n');
    return [
      '---',
      `name: ${name}`,
      'description: >',
      `  ${description}`,
      `model: ${model}`,
      'tools:',
      tools,
      '---',
      '',
    ].join('\n');
  }

  if (harness === 'claude') {
    return [
      '---',
      `name: ${name}`,
      'description: >',
      `  ${description}`,
      `tools: ${cfg.defaultTools}`,
      `model: ${model}`,
      '---',
      '',
    ].join('\n');
  }

  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `model: ${model}`,
    '---',
    '',
  ].join('\n');
}

async function readDirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function loadCanonicalAgents() {
  const entries = await readDirSafe(CANONICAL_DIR);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.agent.md'))
    .map((entry) => entry.name)
    .sort();

  const agents = [];
  for (const fileName of files) {
    const slug = fileName.replace(/\.agent\.md$/, '');
    const fullPath = path.join(CANONICAL_DIR, fileName);
    const content = await fs.readFile(fullPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(content);
    if (!frontmatter) {
      throw new Error(`Canonical agent missing frontmatter: ${fullPath}`);
    }
    const canonicalMeta = parseCanonicalMeta(frontmatter, slug);
    agents.push({ slug, body: normalizeBody(body), canonicalMeta });
  }
  return agents;
}

async function syncHarness(harness, canonicalAgents, mode, prune) {
  const cfg = HARNESS_CONFIG[harness];
  await fs.mkdir(cfg.dir, { recursive: true });

  const existingEntries = await readDirSafe(cfg.dir);
  const existingFiles = existingEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(cfg.extension))
    .map((entry) => entry.name);

  const canonicalSlugs = new Set(canonicalAgents.map((agent) => agent.slug));
  const report = {
    harness,
    created: [],
    updated: [],
    unchanged: [],
    removed: [],
    drifted: [],
    missing: [],
    extra: [],
    malformed: [],
  };

  for (const canonical of canonicalAgents) {
    const fileName = `${canonical.slug}${cfg.extension}`;
    const targetPath = path.join(cfg.dir, fileName);
    let existingContent = null;
    try {
      existingContent = await fs.readFile(targetPath, 'utf8');
    } catch {
      existingContent = null;
    }

    const desiredBody = canonical.body;
    if (!existingContent) {
      const frontmatter = buildFrontmatter(
        harness,
        canonical.slug,
        canonical.canonicalMeta,
      );
      const nextContent = `${frontmatter}${desiredBody}\n`;
      if (mode === 'apply') {
        await fs.writeFile(targetPath, nextContent, 'utf8');
      }
      report.created.push(path.relative(repoRoot, targetPath));
      report.missing.push(path.relative(repoRoot, targetPath));
      continue;
    }

    const { frontmatter, body } = splitFrontmatter(existingContent);
    const rel = path.relative(repoRoot, targetPath);

    // An existing target's frontmatter is owned by the harness, not by this
    // script — it carries per-agent `tools:` grants (e.g. CodeExplorer's
    // read-only + graphify set) that defaults would silently widen. If it
    // cannot be parsed, refuse to touch the file instead of regenerating it.
    if (!frontmatter) {
      report.malformed.push(rel);
      continue;
    }

    const existingBody = normalizeBody(body);
    const bodyDiffers = existingBody !== desiredBody;
    if (bodyDiffers) {
      report.drifted.push(rel);
      if (mode === 'apply') {
        const nextContent = `${frontmatter}${desiredBody}\n`;
        await fs.writeFile(targetPath, nextContent, 'utf8');
        report.updated.push(rel);
      }
    } else {
      report.unchanged.push(rel);
    }
  }

  for (const fileName of existingFiles) {
    const slug = fileName.replace(/\.md$/, '');
    if (!canonicalSlugs.has(slug)) {
      const targetPath = path.join(cfg.dir, fileName);
      const rel = path.relative(repoRoot, targetPath);
      report.extra.push(rel);
      if (mode === 'apply' && prune) {
        await fs.rm(targetPath, { force: true });
        report.removed.push(rel);
      }
    }
  }

  return report;
}

function printReport(mode, prune, reports) {
  console.log(
    `Sub-agent sync mode: ${mode}${mode === 'apply' ? ` (prune=${prune})` : ''}`,
  );

  for (const report of reports) {
    console.log(`\n[${report.harness}]`);
    if (mode === 'check') {
      console.log(`  missing: ${report.missing.length}`);
      console.log(`  drifted: ${report.drifted.length}`);
      console.log(`  extra: ${report.extra.length}`);
      console.log(`  malformed: ${report.malformed.length}`);
      if (report.missing.length)
        report.missing.forEach((p) => console.log(`    + ${p}`));
      if (report.drifted.length)
        report.drifted.forEach((p) => console.log(`    ~ ${p}`));
      if (report.extra.length)
        report.extra.forEach((p) => console.log(`    - ${p}`));
      if (report.malformed.length)
        report.malformed.forEach((p) => console.log(`    ! ${p}`));
    } else {
      console.log(`  created: ${report.created.length}`);
      console.log(`  updated: ${report.updated.length}`);
      console.log(`  removed: ${report.removed.length}`);
      console.log(`  skipped (malformed): ${report.malformed.length}`);
      if (report.created.length)
        report.created.forEach((p) => console.log(`    + ${p}`));
      if (report.updated.length)
        report.updated.forEach((p) => console.log(`    ~ ${p}`));
      if (report.removed.length)
        report.removed.forEach((p) => console.log(`    - ${p}`));
      if (report.malformed.length)
        report.malformed.forEach((p) => console.log(`    ! ${p}`));
    }
  }
}

function hasDrift(reports) {
  return reports.some(
    (report) =>
      report.missing.length ||
      report.drifted.length ||
      report.extra.length ||
      report.malformed.length,
  );
}

function hasMalformed(reports) {
  return reports.some((report) => report.malformed.length);
}

async function main() {
  const { mode, prune } = parseArgs(process.argv);
  const canonicalAgents = await loadCanonicalAgents();

  const reports = [];
  for (const harness of Object.keys(HARNESS_CONFIG)) {
    const report = await syncHarness(harness, canonicalAgents, mode, prune);
    reports.push(report);
  }

  printReport(mode, prune, reports);

  if (hasMalformed(reports)) {
    console.error(
      '\nERROR: the files marked ! have unreadable frontmatter and were left untouched.\n' +
        'Fix their `---` delimited frontmatter by hand, then re-run. This script will not\n' +
        'regenerate frontmatter for an existing file — doing so would overwrite its `tools:` grants.',
    );
    process.exitCode = 1;
    return;
  }

  if (mode === 'check' && hasDrift(reports)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
