#!/usr/bin/env node
// Asserts bidirectional coverage of the feature index against dashboard
// routes (ADR 0043).
//
//   node tools/scripts/check-feature-index.mjs [featureIndexPath] [dashboardRoot] [exclusionsPath]
//
// `docs/features/README.md` carries a "Features Index" table naming each
// product feature. This slugifies each name ("Mobile Numbers" ->
// "mobile-numbers") and checks it bidirectionally against the top-level
// directories Next.js actually serves under `apps/myorganizer/src/app/dashboard`:
//
// 1. Every indexed feature must map to a real route.
// 2. Every real route (except those explicitly excluded) must have an index entry.
//
// Platform-level routes like `account` (administers settings, not a feature)
// are exempted in tools/config/feature-index-exclusions.json with documented
// reasons. Every exclusion is validated to exist; a stale exemption fails.
//
// Exit 0 = bidirectional coverage holds. Exit 1 = drift or staleness.
// Exit 2 = the check could not run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const FEATURE_INDEX = resolve(process.argv[2] ?? 'docs/features/README.md');
const DASHBOARD_ROOT = resolve(
  process.argv[3] ?? 'apps/myorganizer/src/app/dashboard',
);
const EXCLUSIONS_CONFIG = resolve(
  process.argv[4] ?? 'tools/config/feature-index-exclusions.json',
);

const fail = (msg) => {
  console.error(`feature-index: ${msg}`);
  process.exit(2);
};

if (!existsSync(FEATURE_INDEX)) fail(`${FEATURE_INDEX} not found`);
if (!existsSync(DASHBOARD_ROOT)) fail(`${DASHBOARD_ROOT} not found`);
if (!existsSync(EXCLUSIONS_CONFIG)) fail(`${EXCLUSIONS_CONFIG} not found`);

let exclusions = new Set();
try {
  const config = JSON.parse(readFileSync(EXCLUSIONS_CONFIG, 'utf8'));
  if (config.exclusions && Array.isArray(config.exclusions)) {
    exclusions = new Set(config.exclusions.map((e) => e.route));
  }
} catch (err) {
  fail(`could not parse ${EXCLUSIONS_CONFIG}: ${err.message}`);
}

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

// Check 1: every indexed feature must map to a real route
for (const feature of features) {
  const slug = slugify(feature);
  if (!realRoutes.has(slug)) {
    findings.push(
      `"${feature}" maps to /dashboard/${slug}, which the app router does not serve`,
    );
  }
}

// Check 2: every real route (except excluded ones) must have an index entry
const indexedSlugs = new Set(features.map(slugify));
for (const route of realRoutes) {
  if (!exclusions.has(route) && !indexedSlugs.has(route)) {
    findings.push(
      `dashboard route /dashboard/${route} has no entry in the feature index`,
    );
  }
}

// Check 3: validate that excluded routes actually exist
const exclusionsConfig = JSON.parse(readFileSync(EXCLUSIONS_CONFIG, 'utf8'));
if (exclusionsConfig.exclusions && Array.isArray(exclusionsConfig.exclusions)) {
  for (const exclusion of exclusionsConfig.exclusions) {
    if (!realRoutes.has(exclusion.route)) {
      findings.push(
        `exclusion for /dashboard/${exclusion.route} is stale; the route no longer exists`,
      );
    }
  }
}

if (findings.length) {
  console.error(`feature-index: ${findings.length} issue(s) found\n`);
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    `\nUpdate ${FEATURE_INDEX}, the app router, or the exclusions config, as appropriate.`,
  );
  process.exit(1);
}

console.log(
  `feature-index: ${features.length} feature(s) indexed, ${realRoutes.size} route(s) exist, ${exclusions.size} route(s) excluded, all checks pass`,
);
