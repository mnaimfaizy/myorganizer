#!/usr/bin/env node
// Asserts that docs/agents/orchestration-map.html still describes the fleet it claims to.
//
//   node tools/scripts/check-agent-map.mjs
//
// The page is a hand-designed diagram, so its prose cannot be generated. What can be checked
// is its roster: the embedded manifest must agree with tools/config/agent-model-policy.json,
// and every agent in the manifest must actually appear in the diagram. A policy change that
// leaves the page behind fails here rather than becoming a confidently wrong reference.
//
// Exit 0 = in sync. Exit 1 = drift (fix the page). Exit 2 = the check could not run.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = 'docs/agents/orchestration-map.html';
const POLICY = 'tools/config/agent-model-policy.json';
const AGENTS_DIR = '.github/agents';

const fail = (msg) => {
  console.error(`agent-map: ${msg}`);
  process.exit(2);
};

if (!existsSync(PAGE)) fail(`${PAGE} not found`);
if (!existsSync(POLICY)) fail(`${POLICY} not found`);

const page = readFileSync(PAGE, 'utf8');
const policy = JSON.parse(readFileSync(POLICY, 'utf8'));

const manifestRaw = page.match(
  /<script type="application\/json" id="agent-map-manifest">([\s\S]*?)<\/script>/,
);
if (!manifestRaw)
  fail(
    `no #agent-map-manifest block in ${PAGE} — rebuild it with build-agent-map.mjs`,
  );

let manifest;
try {
  manifest = JSON.parse(manifestRaw[1]);
} catch (err) {
  fail(`#agent-map-manifest is not valid JSON: ${err.message}`);
}

// Policy keys are kebab file stems; the diagram labels agents by their frontmatter `name`.
const displayNames = Object.fromEntries(
  readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.agent.md'))
    .map((f) => {
      const name = readFileSync(join(AGENTS_DIR, f), 'utf8').match(
        /^name:\s*(.+)$/m,
      );
      if (!name) fail(`${f} has no name: in its frontmatter`);
      // Frontmatter quotes its values; the diagram labels agents bare.
      return [
        f.replace('.agent.md', ''),
        name[1].trim().replace(/^['"]|['"]$/g, ''),
      ];
    }),
);

const expected = Object.fromEntries(
  Object.entries(policy.agents).map(([key, v]) => [
    displayNames[key] ?? key,
    v.tier,
  ]),
);
const claimed = manifest.agents ?? {};
const findings = [];

for (const [name, tier] of Object.entries(expected)) {
  if (!(name in claimed)) {
    findings.push(`missing from the page: ${name} (${tier})`);
  } else if (claimed[name] !== tier) {
    findings.push(
      `tier drift: ${name} is ${tier} in policy, ${claimed[name]} on the page`,
    );
  }
}
for (const name of Object.keys(claimed)) {
  if (!(name in expected))
    findings.push(`page lists an agent the policy does not: ${name}`);
}

// A manifest entry that never appears in the diagram body is a roster the reader cannot see.
for (const name of Object.keys(claimed)) {
  if (!page.includes(`>${name}<`) && !page.includes(`data-agent="${name}"`)) {
    findings.push(
      `${name} is in the manifest but never rendered in the diagram`,
    );
  }
}

if (manifest.policyReviewedAt !== policy.reviewedAt) {
  findings.push(
    `policy reviewedAt moved: page says ${manifest.policyReviewedAt}, policy says ${policy.reviewedAt}`,
  );
}

if (findings.length > 0) {
  console.error(
    `agent-map: ${findings.length} finding(s) — ${PAGE} is out of date\n`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    `\nRebuild the page from the design export, or update the diagram to match ${POLICY}.`,
  );
  process.exit(1);
}

console.log(
  `agent-map: OK — ${Object.keys(expected).length} agents, tiers match ${POLICY} (reviewed ${policy.reviewedAt})`,
);
