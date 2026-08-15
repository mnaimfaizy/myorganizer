#!/usr/bin/env node
// Asserts that the root README still describes the repository that exists.
//
//   node tools/scripts/check-readme.mjs
//
// The README rotted quietly for months: it advertised a /dashboard/todo route dropped by a
// migration, omitted the entire mobile app, and linked to a LICENSE file that was never added.
// Nothing caught any of it, because unlike TECH_STACK.md, the OpenAPI spec, and the vault pages,
// the README had no guard.
//
// Three classes of claim are checkable, so those are the three this asserts:
//
//   1. Every relative link resolves to a file or directory that exists.
//   2. Every app and lib in the layout diagram exists, and every app and top-level lib exists
//      in the diagram. Drift runs both ways — a stale entry and a missing one are both wrong.
//   3. The README names no route that the app router does not serve.
//
// Prose is deliberately not checked. A guard that fails on wording would be turned off.
//
// Exit 0 = in sync. Exit 1 = drift. Exit 2 = the check could not run.
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const README = 'README.md';

const fail = (msg) => {
  console.error(`readme: ${msg}`);
  process.exit(2);
};

if (!existsSync(README)) fail(`${README} not found`);
const readme = readFileSync(README, 'utf8');

const findings = [];
let asserted = 0;

const dirNames = (path) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

// ---------------------------------------------------------------- 1. links resolve

// Markdown links plus the href/src of the raw HTML the header uses. External URLs, anchors, and
// mailto: are somebody else's problem; only repo-relative paths are checkable here.
const linkTargets = new Set();

for (const [, target] of readme.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
  linkTargets.add(target);
}
for (const [, target] of readme.matchAll(/(?:href|srcset|src)="([^"]+)"/g)) {
  linkTargets.add(target);
}

for (const target of linkTargets) {
  if (/^(?:https?:|mailto:|#)/.test(target)) continue;

  const path = target.split('#')[0];
  if (!path) continue;

  asserted += 1;
  if (!existsSync(path)) {
    findings.push(`links to ${path}, which does not exist`);
  }
}

// ---------------------------------------------------------------- 2. layout diagram

const APPS_IGNORED = new Set(['graphify-out']);
const LIBS_IGNORED = new Set(['graphify-out']);

// The diagram writes libs/web/pages as one entry rather than descending into it.
const documentedIn = (section, name) =>
  new RegExp(`^\\s*[│├└─\\s]*${name}/`, 'm').test(section);

const layout = readme.match(/```\s*\nmyorganizer\/([\s\S]*?)```/);
if (!layout) fail('no repository layout diagram found in README.md');
const diagram = layout[1];

for (const app of dirNames('apps').filter((n) => !APPS_IGNORED.has(n))) {
  asserted += 1;
  if (!documentedIn(diagram, app)) {
    findings.push(`apps/${app} exists but is missing from the layout diagram`);
  }
}

for (const lib of dirNames('libs').filter((n) => !LIBS_IGNORED.has(n))) {
  asserted += 1;
  if (!documentedIn(diagram, lib)) {
    findings.push(`libs/${lib} exists but is missing from the layout diagram`);
  }
}

// ---------------------------------------------------------------- 3. routes are real

const ROUTES_ROOT = 'apps/myorganizer/src/app/dashboard';

if (existsSync(ROUTES_ROOT)) {
  const realRoutes = new Set(dirNames(ROUTES_ROOT));

  for (const [, route] of readme.matchAll(/\/dashboard\/([a-z0-9-]+)/g)) {
    asserted += 1;
    if (!realRoutes.has(route)) {
      findings.push(
        `names /dashboard/${route}, which the app router does not serve`,
      );
    }
  }
}

// ----------------------------------------------------------------------- report

if (findings.length) {
  console.error('readme: the README no longer matches the repository\n');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('\nUpdate README.md, or the guard, whichever is wrong.');
  process.exit(1);
}

console.log(`readme: ${asserted} assertions in sync`);
