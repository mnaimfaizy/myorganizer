#!/usr/bin/env node
// Converts a dc-runtime design export into a single self-contained page under docs/.
//
//   node tools/scripts/build-agent-map.mjs <export-dir> <out-file>
//
// The export ships as `<name>.dc.html` + `support.js` + `ds/styles.css`, and expects a
// React runtime it does not bundle. The page's own logic is plain DOM, so the runtime is
// dropped rather than vendored. Content is copied verbatim; only delivery changes:
//
//   - inline ds/styles.css, minus its Google-Fonts @import (no network at render time)
//   - unwrap <x-dc> / <helmet>, drop the support.js script tag
//   - re-express the dark block so an explicit theme choice wins in both directions
//   - unwrap the DCLogic class into a plain IIFE, preserving the export's prop defaults
//   - embed the agent manifest that tools/scripts/check-agent-map.mjs asserts against
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error('usage: build-agent-map.mjs <export-dir> <out-file>');
  process.exit(64);
}

const repoRoot = process.cwd();
const dcFile = readdirSync(srcDir).find((f) => f.endsWith('.dc.html'));
if (!dcFile) {
  console.error(`no *.dc.html found in ${srcDir}`);
  process.exit(65);
}

let html = readFileSync(join(srcDir, dcFile), 'utf8');
let ds = readFileSync(join(srcDir, 'ds', 'styles.css'), 'utf8');

// Design-system tokens. The remote @import cannot resolve in a sandboxed page, so the two
// families are embedded below instead; the stacks keep fallbacks for the base64-stripped case.
ds = ds
  .replace(/@import url\([^)]*\);\s*/g, '')
  .replace(
    '--font-heading: "Caprasimo", system-ui, sans-serif;',
    '--font-heading: "Caprasimo", Georgia, "Iowan Old Style", "Palatino Linotype", serif;',
  )
  .replace(
    '--font-body: "Figtree", system-ui, sans-serif;',
    '--font-body: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
  );

// The design's own typefaces, embedded as data URIs so the page renders identically offline,
// behind a CSP, and from disk. Latin subset only; Figtree is variable across 400-800, which is
// the range the diagram actually uses. See tools/assets/fonts/README.md for provenance.
const fontDir = join(repoRoot, 'tools/assets/fonts');
const embed = (file) => readFileSync(join(fontDir, file)).toString('base64');
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, ' +
  'U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, ' +
  'U+2212, U+2215, U+FEFF, U+FFFD';
const fontFaces = `
@font-face {
  font-family: 'Caprasimo';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  unicode-range: ${LATIN};
  src: url(data:font/woff2;base64,${embed('caprasimo-400-latin.woff2')}) format('woff2');
}
@font-face {
  font-family: 'Figtree';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  unicode-range: ${LATIN};
  src: url(data:font/woff2;base64,${embed('figtree-400-800-latin.woff2')}) format('woff2');
}
`.trim();

const pageStyle = html.match(
  /<helmet>[\s\S]*?<style>([\s\S]*?)<\/style>[\s\S]*?<\/helmet>/,
)[1];

// `prefers-color-scheme` alone cannot be overridden by a viewer toggle; mirror the dark
// declarations onto [data-theme="dark"] and guard the media query with [data-theme="light"].
const darkDecls = pageStyle.match(
  /@media \(prefers-color-scheme: dark\)\{\s*:root\{([\s\S]*?)\}\s*\}/,
)[1];
const themedStyle = pageStyle.replace(
  /@media \(prefers-color-scheme: dark\)\{\s*:root\{[\s\S]*?\}\s*\}/,
  `@media (prefers-color-scheme: dark){\n  :root:not([data-theme="light"]){${darkDecls}}\n}\n` +
    `:root[data-theme="dark"]{${darkDecls}}`,
);

const body = html
  .match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1]
  .replace(/<helmet>[\s\S]*?<\/helmet>/, '')
  .trim();

// The manifest is the page's machine-readable claim about the fleet. check-agent-map.mjs
// diffs it against the policy file, so a policy change fails CI instead of rotting the page.
const policy = JSON.parse(
  readFileSync(join(repoRoot, 'tools/config/agent-model-policy.json'), 'utf8'),
);
const agentsDir = join(repoRoot, '.github/agents');
const displayNames = Object.fromEntries(
  readdirSync(agentsDir)
    .filter((f) => f.endsWith('.agent.md'))
    .map((f) => [
      f.replace('.agent.md', ''),
      readFileSync(join(agentsDir, f), 'utf8')
        .match(/^name:\s*(.+)$/m)[1]
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    ]),
);
const manifest = {
  note: 'Asserted by tools/scripts/check-agent-map.mjs. Do not hand-edit — rebuild the page.',
  policyReviewedAt: policy.reviewedAt,
  agents: Object.fromEntries(
    Object.entries(policy.agents)
      .map(([key, v]) => [displayNames[key] ?? key, v.tier])
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
};

const script = `
(function(){
  var root = document.querySelector('[data-map-root]');
  if (!root) return;
  var dimOpacity = '0.13';
  var dims = function(){ return Array.prototype.slice.call(root.querySelectorAll('[data-dim]')); };
  var set = function(el, on){
    el.style.opacity = on ? '1' : dimOpacity;
    el.style.filter = on ? 'none' : 'saturate(0.2)';
  };
  var clear = function(){ dims().forEach(function(el){ set(el, true); }); };
  var filter = null;
  var matchesFilter = function(el){
    return !filter || (el.getAttribute('data-pipe') || '').split(/\\s+/).indexOf(filter) !== -1;
  };
  var applyFilter = function(){ dims().forEach(function(el){ set(el, matchesFilter(el)); }); };

  root.addEventListener('pointerover', function(e){
    var t = e.target.closest && e.target.closest('[data-agent]');
    if (!t || !root.contains(t)) return;
    var names = (t.getAttribute('data-agent') || '').split('|');
    dims().forEach(function(el){
      var own = (el.getAttribute('data-agent') || '').split('|');
      set(el, names.some(function(n){ return own.indexOf(n) !== -1; }));
    });
  });
  root.addEventListener('pointerout', function(e){
    var t = e.target.closest && e.target.closest('[data-agent]');
    if (!t) return;
    if (e.relatedTarget && t.contains(e.relatedTarget)) return;
    applyFilter();
  });
  root.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-filter]');
    if (!b) return;
    var v = b.getAttribute('data-filter');
    filter = (v === 'all' || filter === v) ? null : v;
    root.querySelectorAll('[data-filter]').forEach(function(x){
      var active = (filter === null && x.getAttribute('data-filter') === 'all') || x.getAttribute('data-filter') === filter;
      x.style.background = active ? 'var(--ink)' : 'transparent';
      x.style.color = active ? 'var(--paper)' : 'var(--ink)';
      x.style.borderColor = active ? 'var(--ink)' : 'var(--line)';
    });
    if (filter) applyFilter(); else clear();
  });
})();
`.trim();

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sub-agent orchestration map — MyOrganizer</title>
<script type="application/json" id="agent-map-manifest">
${JSON.stringify(manifest, null, 2)}
</script>
<style>
${fontFaces}
</style>
<style>
${ds.trim()}
</style>
<style>
${themedStyle.trim()}
[data-map-root]{overflow-x:hidden}
@media (max-width:900px){
  [data-map-root] section > div[style*="grid-template-columns"]{overflow-x:auto}
}
</style>
</head>
<body>

${body}

<script>
${script}
</script>
</body>
</html>
`;

writeFileSync(outFile, out, 'utf8');
console.log(`wrote ${outFile} (${(out.length / 1024).toFixed(1)} KB)`);
console.log(
  `manifest: ${Object.keys(manifest.agents).length} agents from policy`,
);
