#!/usr/bin/env node
// Asserts that docs/agents/skill-atlas.html still describes the skill system it claims to.
//
//   node tools/scripts/check-skill-map.mjs
//
// The atlas is a hand-designed page, so its layout and edge classifications cannot be
// generated. What can be checked is everything it asserts about the filesystem: the embedded
// #skill-atlas-manifest block must agree with .agents/skills, .github/agents and AGENTS.md,
// and — the check that matters most — every tooltip description must still be byte-identical
// to the `description:` in the skill's own frontmatter. That string is the exact text the
// model matches when deciding whether to load a skill, so a paraphrase on the page is a page
// that misreports routing.
//
// Two classes of assertion live here, and they fail differently:
//
//   DERIVED    — recomputed from source on every run. Drift is a hard failure.
//   REVIEWED   — a human classified something the filesystem cannot decide on its own (which
//                cross-reference is a prohibition vs a handoff; which substring match is a
//                real delegation). These cannot be recomputed, so instead the script watches
//                the *inputs* to that judgement and fails when they move, asking for a
//                re-review rather than silently trusting a stale classification.
//
// Exit 0 = in sync. Exit 1 = drift (fix the page). Exit 2 = the check could not run.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = 'docs/agents/skill-atlas.html';
const SKILLS_DIR = '.agents/skills';
const AGENTS_DIR = '.github/agents';
const AGENTS_MIRROR = '.claude/agents';
const AGENTS_MD = 'AGENTS.md';
const EXTERNAL_MD = join(SKILLS_DIR, 'EXTERNAL_SKILLS.md');

const fail = (msg) => {
  console.error(`skill-map: ${msg}`);
  process.exit(2);
};

for (const p of [PAGE, SKILLS_DIR, AGENTS_DIR, AGENTS_MD, EXTERNAL_MD]) {
  if (!existsSync(p)) fail(`${p} not found`);
}

const page = readFileSync(PAGE, 'utf8');
const findings = [];
const note = (msg) => findings.push(msg);

// ── Manifest ────────────────────────────────────────────────────────────────
const manifestRaw = page.match(
  /<script type="application\/json" id="skill-atlas-manifest">([\s\S]*?)<\/script>/,
);
if (!manifestRaw) fail(`no #skill-atlas-manifest block in ${PAGE}`);

let manifest;
try {
  manifest = JSON.parse(manifestRaw[1]);
} catch (err) {
  fail(`#skill-atlas-manifest is not valid JSON: ${err.message}`);
}

// ── Frontmatter ─────────────────────────────────────────────────────────────
// No YAML dependency in this repo, and the atlas only needs two scalars. Supports the four
// shapes actually used across .agents/skills: bare, quoted, `|` literal and `>-` folded.
function frontmatter(src) {
  if (!src.startsWith('---')) return null; // no block at all — a finding, not an error
  const end = src.indexOf('\n---', 3);
  if (end === -1) return null;
  const body = src.slice(3, end);
  const out = {};
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') {
      const folded = rest.startsWith('>');
      const block = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].trim() !== '' && !/^\s{2,}/.test(lines[j])) break;
        block.push(lines[j].replace(/^ {2}/, ''));
      }
      i = j - 1;
      while (block.length && block[block.length - 1].trim() === '') block.pop();
      // Folded scalars join on single newlines and keep blank lines as paragraph breaks.
      out[key] = folded
        ? block
            .join('\n')
            .split(/\n{2,}/)
            .map((p) => p.split('\n').join(' ').trim())
            .join('\n\n')
        : block.join('\n');
    } else {
      out[key] = rest.replace(/^['"]|['"]$/g, '').trim();
    }
  }
  return out;
}

const skillDirs = readdirSync(SKILLS_DIR)
  .filter((d) => statSync(join(SKILLS_DIR, d)).isDirectory())
  .sort();

const skills = skillDirs.map((dir) => {
  const p = join(SKILLS_DIR, dir, 'SKILL.md');
  if (!existsSync(p)) fail(`${dir} has no SKILL.md`);
  const src = readFileSync(p, 'utf8');
  const fm = frontmatter(src);
  return {
    dir,
    fm,
    description: fm?.description ?? null,
    human: fm?.['disable-model-invocation'] === 'true',
  };
});

// ── DERIVED: node inventory ─────────────────────────────────────────────────
const eq = (label, actual, claimed) => {
  if (actual !== claimed)
    note(`${label}: source says ${actual}, page says ${claimed}`);
};
const eqList = (label, actual, claimed) => {
  const a = [...actual].sort().join(', ');
  const c = [...(claimed ?? [])].sort().join(', ');
  if (a !== c) note(`${label}: source says [${a}], page says [${c}]`);
};

eq('repoSkillDirCount', skillDirs.length, manifest.repoSkillDirCount);
eqList(
  'repoSkillsMissingFrontmatter',
  skills.filter((s) => !s.description).map((s) => s.dir),
  manifest.repoSkillsMissingFrontmatter,
);
eqList(
  'repoSkillsHumanInvokeOnly',
  skills.filter((s) => s.human).map((s) => s.dir),
  manifest.repoSkillsHumanInvokeOnly,
);

const agentsMd = readFileSync(AGENTS_MD, 'utf8');
const absentFromChooser = skillDirs.filter(
  (d) => !agentsMd.includes(`${SKILLS_DIR}/${d}/`),
);
eq(
  'repoSkillsAbsentFromAgentsMdChooser',
  absentFromChooser.length,
  manifest.repoSkillsAbsentFromAgentsMdChooser,
);

const canonical = readdirSync(AGENTS_DIR).filter((f) =>
  f.endsWith('.agent.md'),
);
eq(
  'subAgentCanonicalFileCount',
  canonical.length,
  manifest.subAgentCanonicalFileCount,
);
if (existsSync(AGENTS_MIRROR)) {
  eq(
    'subAgentMirrorFileCount',
    readdirSync(AGENTS_MIRROR).filter((f) => f.endsWith('.md')).length,
    manifest.subAgentMirrorFileCount,
  );
} else {
  note(`${AGENTS_MIRROR} not found — run \`yarn agents:sync\``);
}

// Agent display names come from frontmatter, same as check-agent-map.mjs.
const agentNames = canonical.map((f) => {
  const m = readFileSync(join(AGENTS_DIR, f), 'utf8').match(/^name:\s*(.+)$/m);
  if (!m) fail(`${f} has no name: in its frontmatter`);
  return m[1].trim().replace(/^['"]|['"]$/g, '');
});

// ── Skill → skill cross-references (DERIVED count) ──────────────────────────
const skillText = new Map(
  skillDirs.map((d) => {
    const chunks = [];
    (function walk(dir) {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else chunks.push(readFileSync(p, 'utf8'));
      }
    })(join(SKILLS_DIR, d));
    return [d, chunks.join('\n')];
  }),
);

let ssPairs = 0;
for (const from of skillDirs) {
  for (const to of skillDirs) {
    if (from === to) continue;
    const re = new RegExp(`skills/${to}/|\`${to}\`|/${to}(?![A-Za-z0-9-])`);
    if (re.test(skillText.get(from))) ssPairs++;
  }
}
eq('skillToSkillEdgeCount', ssPairs, manifest.skillToSkillEdgeCount);

// The atlas suppresses `handoff`'s outbound references: all of them come from one line that
// names skills as examples, not as routing. That suppression is the only gap between the raw
// pair count and what the page draws, so the two keys must differ by exactly that much.
let handoffOut = 0;
for (const to of skillDirs) {
  if (to === 'handoff') continue;
  const re = new RegExp(`skills/${to}/|\`${to}\`|/${to}(?![A-Za-z0-9-])`);
  if (re.test(skillText.get('handoff'))) handoffOut++;
}
eq(
  'skillToSkillEdgesRenderedCount',
  ssPairs - handoffOut,
  manifest.skillToSkillEdgesRenderedCount,
);

// ── Skill → sub-agent (DERIVED, with a REVIEWED exclusion list) ─────────────
// Word boundaries are mandatory: a plain substring search for `TestRunner` matches the Nx CLI
// flag `--unitTestRunner=jest` 8 times in nx-monorepo-workflow. Even with boundaries, four
// agent names are ordinary English words and need the hand-verified exclusions below.
const AGENT_FALSE_POSITIVES = {
  Audit: ['modern-web-guidance'], // prose in guides/privacy and guides/security
  Docs: ['create-hooks', 'design-brief'], // a `## Docs` heading; the English word
  Commit: ['implement', 'release-and-deploy-workflow'], // "Commit/PR only if…", "5. Commit:"
};

let agentEdges = 0;
const unreferenced = [];
for (const a of agentNames) {
  const re = new RegExp(`(?<![A-Za-z])${a}(?![A-Za-z])`);
  const excluded = AGENT_FALSE_POSITIVES[a] ?? [];
  const parents = skillDirs.filter(
    (d) => re.test(skillText.get(d)) && !excluded.includes(d),
  );
  // A stale exclusion is as dangerous as a missing one: it silently drops a real edge.
  for (const x of excluded) {
    if (!re.test(skillText.get(x))) {
      note(
        `stale exclusion: ${a} is no longer mentioned in ${x} — drop it from AGENT_FALSE_POSITIVES`,
      );
    }
  }
  agentEdges += parents.length;
  if (parents.length === 0) unreferenced.push(a);
}
eq('skillToSubAgentEdgeCount', agentEdges, manifest.skillToSubAgentEdgeCount);
eqList(
  'subAgentsUnreferencedBySkills',
  unreferenced,
  manifest.subAgentsUnreferencedBySkills,
);

// ── REVIEWED: edge classification ───────────────────────────────────────────
// Which cross-reference is a prohibition, a handoff, a route or a vocabulary prerequisite is a
// reading of the prose — no script can decide it. So instead of recomputing, assert that the
// page's own classified set still sums to what its manifest claims, and that the prohibition
// count has not moved without someone re-reading the sources.
const classified = [...page.matchAll(/,\s*"([ABCD])",\s*"/g)].map((m) => m[1]);
if (classified.length === 0) {
  note(
    'could not read the classified edge list from the page — did its script change shape?',
  );
} else {
  const warns = classified.filter((t) => t === 'C').length;
  eq(
    'skillToSkillWarnsOffEdgeCount',
    warns,
    manifest.skillToSkillWarnsOffEdgeCount,
  );
}

// ── DERIVED: external skills ────────────────────────────────────────────────
const ext = readFileSync(EXTERNAL_MD, 'utf8');
const section = (heading) => {
  const i = ext.indexOf(heading);
  if (i === -1) return '';
  const rest = ext.slice(i + heading.length);
  const j = rest.search(/\n## /);
  return j === -1 ? rest : rest.slice(0, j);
};
const pkgs = (s) =>
  [...s.matchAll(/`([\w.-]+\/[\w.-]+@[\w.-]+)`/g)].map((m) => m[1]);
const defaults = [...new Set(pkgs(section('## Default Install Set')))];
const optional = [...new Set(pkgs(section('## Optional Add-Ons')))];
eq(
  'externalApprovedDefaultCount',
  defaults.length,
  manifest.externalApprovedDefaultCount,
);
eq(
  'externalApprovedOptionalCount',
  optional.length,
  manifest.externalApprovedOptionalCount,
);

const vendored = [...defaults, ...optional].filter((p) =>
  skillDirs.includes(p.split('@').pop()),
);
eq(
  'externalApprovedVendoredCount',
  vendored.length,
  manifest.externalApprovedVendoredCount,
);

// ── DERIVED: dangling references ────────────────────────────────────────────
// Backticked `/slug` invocations that name no skill. Two are known aliases with no registry
// behind them, and `/tmp` is a filesystem path; the vendored third-party guides are upstream
// prose and are not scanned.
const ALIASES = new Set(['commit', 'create-pr']);
const NOT_INVOCATIONS = new Set(['tmp']);
const dangling = new Set();
for (const d of skillDirs) {
  if (d === 'modern-web-guidance') continue; // vendored upstream docs
  for (const m of skillText.get(d).matchAll(/`\/([a-z][a-z0-9-]{2,})`/g)) {
    const s = m[1];
    if (skillDirs.includes(s) || ALIASES.has(s) || NOT_INVOCATIONS.has(s))
      continue;
    dangling.add(s);
  }
}
eqList(
  'danglingSkillReferences',
  [...dangling],
  manifest.danglingSkillReferences,
);

// ── The reading test, enforced ──────────────────────────────────────────────
// Every Tier-1 tooltip must carry the description verbatim. This is the whole point of the
// page: the description is what the model matches on, so a drifted copy misreports routing.
const fmBlock = page.match(/const SKILL_FM = (\[[\s\S]*?\]);/);
if (!fmBlock) {
  note(
    'could not find the SKILL_FM block in the page — descriptions are unverifiable',
  );
} else {
  let embedded;
  try {
    embedded = JSON.parse(fmBlock[1]);
  } catch (err) {
    note(`SKILL_FM is not valid JSON: ${err.message}`);
    embedded = null;
  }
  if (embedded) {
    const byDir = new Map(embedded.map((e) => [e.dir, e]));
    for (const s of skills) {
      const e = byDir.get(s.dir);
      if (!e) {
        note(`${s.dir} is on disk but missing from the page`);
        continue;
      }
      const onPage = e.description ?? null;
      if (onPage !== s.description) {
        note(
          s.description === null
            ? `${s.dir}: SKILL.md has no description, but the page shows one — never invent a description`
            : onPage === null
              ? `${s.dir}: SKILL.md has a description, but the page shows none`
              : `${s.dir}: description on the page is not verbatim (${onPage.length} chars vs ${s.description.length} on disk)`,
        );
      }
    }
    for (const e of embedded) {
      if (!skillDirs.includes(e.dir))
        note(`page lists a skill that is not on disk: ${e.dir}`);
    }
  }
}

// Every sub-agent named in the manifest must actually be rendered, per check-agent-map.mjs.
for (const a of manifest.subAgentsUnreferencedBySkills ?? []) {
  if (!page.includes(`"${a}"`))
    note(`${a} is in the manifest but never rendered in the page`);
}

// ── Report ──────────────────────────────────────────────────────────────────
if (findings.length > 0) {
  console.error(
    `skill-map: ${findings.length} finding(s) — ${PAGE} is out of date\n`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    `\nUpdate the page (and its #skill-atlas-manifest) to match the filesystem.` +
      `\nIf an edge classification changed, re-read the source lines before editing the counts —` +
      `\nthe A/B/C/D types are a reading of the prose, not something this script can recompute.`,
  );
  process.exit(1);
}

console.log(
  `skill-map: OK — ${skillDirs.length} skills, ${canonical.length} sub-agents, ` +
    `${ssPairs} skill→skill refs (${ssPairs - handoffOut} drawn), ${agentEdges} skill→agent, ` +
    `${defaults.length + optional.length} approved external; all ${
      skills.filter((s) => s.description).length
    } descriptions verbatim`,
);
