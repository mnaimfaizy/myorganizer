#!/usr/bin/env node
// Asserts that the feature index names no dashboard route the app router
// does not serve (ADR 0043).
//
//   node tools/scripts/check-feature-index.mjs [featureIndexPath] [dashboardRoot]
//
// `docs/features/README.md` carries a "Features Index" table naming each
// product feature. This slugifies each name ("Mobile Numbers" ->
// "mobile-numbers") and checks it against the top-level directories Next.js
// actually serves under `apps/myorganizer/src/app/dashboard`, the same
// directory `check-readme.mjs` walks for its own route claims.
//
// One-way on purpose: a dashboard route with no feature-index row is not a
// failure here (`account` is a real route and platform-level, not a listed
// product feature). Only a stale index entry — one that used to be a route
// and no longer is — is the failure this incident-shaped check is for.
//
// Exit 0 = every indexed feature resolves to a real route. Exit 1 = drift,
// naming the feature and the route it no longer resolves to. Exit 2 = the
// check could not run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const FEATURE_INDEX = resolve(process.argv[2] ?? 'docs/features/README.md');
const DASHBOARD_ROOT = resolve(
  process.argv[3] ?? 'apps/myorganizer/src/app/dashboard',
);

const fail = (msg) => {
  console.error(`feature-index: ${msg}`);
  process.exit(2);
};

if (!existsSync(FEATURE_INDEX)) fail(`${FEATURE_INDEX} not found`);
if (!existsSync(DASHBOARD_ROOT)) fail(`${DASHBOARD_ROOT} not found`);

const content = readFileSync(FEATURE_INDEX, 'utf8');

const sectionMatch = content.match(
  /## Features Index\s*\n([\s\S]*?)(?:\n## |$)/,
);
if (!sectionMatch)
  fail(`no "## Features Index" section found in ${FEATURE_INDEX}`);
const section = sectionMatch[1];

const slugify = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');

const features = [];
for (const line of section.split('\n')) {
  if (!line.trim().startsWith('|')) continue;
  const cells = line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  if (cells.length === 0) continue;
  const [first] = cells;
  if (first.toLowerCase() === 'feature') continue; // header row
  if (/^:?-+:?$/.test(first)) continue; // separator row
  features.push(first);
}

if (features.length === 0) {
  fail(`no feature rows found under "## Features Index" in ${FEATURE_INDEX}`);
}

const realRoutes = new Set(
  readdirSync(DASHBOARD_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

const findings = [];
for (const feature of features) {
  const slug = slugify(feature);
  if (!realRoutes.has(slug)) {
    findings.push(
      `"${feature}" maps to /dashboard/${slug}, which the app router does not serve`,
    );
  }
}

if (findings.length) {
  console.error(
    `feature-index: ${findings.length} feature index entry(ies) no longer resolve\n`,
  );
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    `\nUpdate ${FEATURE_INDEX}, or the app router, whichever is wrong.`,
  );
  process.exit(1);
}

console.log(
  `feature-index: ${features.length} feature(s) indexed, all resolve to a route the app router serves`,
);
