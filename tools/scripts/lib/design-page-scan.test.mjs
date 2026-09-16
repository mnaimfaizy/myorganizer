import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findCitations,
  fontBlockHash,
  maskHtmlComments,
  RULE_KINDS,
  scanDesignPage,
  scanFactualAssertions,
} from './design-page-scan.mjs';

const SCAN_MODULE_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  'design-page-scan.mjs',
);

const FONT_HASH = 'a'.repeat(64);

/** A page that satisfies every rule, so each test can break exactly one thing. */
function goodPage(overrides = {}) {
  const {
    head = [
      '<meta charset="utf-8" />',
      '<title>Example Page</title>',
      '<script>',
      '  {',
      '    let t = null;',
      '    try {',
      "      t = localStorage.getItem('example-theme');",
      '    } catch (e) {}',
      '  }',
      '</script>',
    ].join('\n'),
    style = [
      '<style>',
      '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
      ':root {',
      '  --ink: #101010;',
      '}',
      '@media (prefers-color-scheme: dark) {',
      "  :root:not([data-theme='light']) {",
      '    --ink: #f0f0f0;',
      '  }',
      '}',
      ":root[data-theme='dark'] {",
      '  --ink: #f0f0f0;',
      '}',
      '</style>',
    ].join('\n'),
    body = [
      '<svg viewBox="0 0 10 10" role="img" aria-label="Example" aria-describedby="exampleDesc">',
      '  <desc id="exampleDesc">A long description.</desc>',
      '  <rect data-tip="alpha" aria-describedby="note-alpha" />',
      '</svg>',
      '<div id="note-alpha">Alpha note.</div>',
      '<a href="../adr/0043-gates-assert-facts.md">ADR 0043</a>',
    ].join('\n'),
    manifest = [
      '<script type="application/json" id="example-manifest">',
      '{ "note": "asserted" }',
      '</script>',
    ].join('\n'),
  } = overrides;
  return [head, style, body, manifest].join('\n');
}

function scan(source, options = {}) {
  return scanDesignPage({
    file: 'docs/example/page.html',
    source,
    canonicalFontHash: FONT_HASH,
    pageFontHash: FONT_HASH,
    prettierIgnored: true,
    adrLinkExists: () => true,
    resolveCitation: () => ({ ok: true }),
    ...options,
  });
}

const rules = (findings) => findings.map((f) => f.rule).sort();

test('a page that follows every house rule produces no findings', () => {
  assert.deepEqual(scan(goodPage()), []);
});

// --- svg-title-tooltip -------------------------------------------------------

test('a <title> inside an <svg> is reported', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img">',
        '  <title>Example diagram</title>',
        '</svg>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['svg-title-tooltip']);
  // head is 10 lines, style 14, so the body's <svg> is line 25 and its <title> is 26.
  assert.equal(findings[0].line, 26);
});

test('the document <title> outside any <svg> is not reported', () => {
  assert.deepEqual(rules(scan(goodPage())), []);
});

test('a <title> in a nested <svg> is still reported', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img">',
        '  <svg x="1">',
        '    <title>Nested</title>',
        '  </svg>',
        '</svg>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['svg-title-tooltip']);
});

test('a <title> discussed inside an HTML comment is not a finding', () => {
  const findings = scan(
    goodPage({
      body: [
        '<!-- Never place a <title> as the first child of a root <svg>. -->',
        '<svg viewBox="0 0 10 10" role="img" aria-label="Example"></svg>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a <title> discussed inside a script comment is not a finding', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<script>',
        '  /* A root-`<svg>` `<title>` renders as one tooltip over the whole canvas,',
        '     so both `<title>` elements are gone. */',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a script that mentions <svg> in a string does not move the tag depth', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<script>',
        '  const open = "<svg viewBox=0011>";',
        '</script>',
        '<title>Trailing document title</title>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a self-closing <svg /> does not leave the scanner inside an svg', () => {
  const findings = scan(
    goodPage({
      body: ['<svg viewBox="0 0 1 1" role="img" aria-label="x" />'].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

// --- tip-note-bijection ------------------------------------------------------

test('a data-tip with no matching note is reported', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x">',
        '  <rect data-tip="alpha" />',
        '  <rect data-tip="beta" />',
        '</svg>',
        '<div id="note-alpha">Alpha.</div>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['tip-note-bijection']);
  assert.match(findings[0].message, /beta/);
});

test('a note with no matching data-tip is reported', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x">',
        '  <rect data-tip="alpha" />',
        '</svg>',
        '<div id="note-alpha">Alpha.</div>',
        '<div id="note-orphan">Nothing points here.</div>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['tip-note-bijection']);
  assert.match(findings[0].message, /orphan/);
});

test('a page with neither tips nor notes satisfies the bijection', () => {
  const findings = scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
    }),
  );
  assert.deepEqual(rules(findings), []);
});

// --- font-block-drift --------------------------------------------------------

test('a font block that differs from the canonical page is reported', () => {
  const findings = scan(goodPage(), { pageFontHash: 'b'.repeat(64) });
  assert.deepEqual(rules(findings), ['font-block-drift']);
});

test('a page with no @font-face block at all is reported', () => {
  const findings = scan(goodPage(), { pageFontHash: null });
  assert.deepEqual(rules(findings), ['font-block-drift']);
  assert.match(findings[0].message, /no @font-face/);
});

// --- external-resource -------------------------------------------------------

test('a <link> element is reported', () => {
  const findings = scan(
    goodPage({
      head: '<title>x</title>\n<link rel="stylesheet" href="theme.css" />',
    }),
  );
  assert.deepEqual(rules(findings), ['external-resource']);
});

test('a <link> to an http origin is one finding, not two', () => {
  const findings = scan(
    goodPage({
      head: '<title>x</title>\n<link rel="stylesheet" href="https://cdn.example.com/x.css" />',
    }),
  );
  assert.deepEqual(rules(findings), ['external-resource']);
  assert.match(findings[0].message, /<link> loads an external/);
});

test('an @import is reported', () => {
  const findings = scan(
    goodPage({
      style: "<style>\n@import url('other.css');\n</style>",
    }),
  );
  assert.ok(rules(findings).includes('external-resource'));
});

test('a script src on an http origin is reported', () => {
  const findings = scan(
    goodPage({
      manifest: '<script src="https://unpkg.com/react/react.js"></script>',
    }),
  );
  assert.ok(rules(findings).includes('external-resource'));
});

test('a bare fetch of an http origin in the inline script is reported', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<script>',
        "  fetch('https://api.example.com/data').then(render);",
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['external-resource']);
  assert.match(findings[0].message, /api\.example\.com/);
});

test('an anchor to an external page is not a self-containment finding', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p>See <a href="https://www.rfc-editor.org/rfc/rfc7519">RFC 7519</a>.</p>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a bare URL in visible prose is reported — it should be an anchor', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p>See https://www.rfc-editor.org/rfc/rfc7519 for the format.</p>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['external-resource']);
});

test('a localStorage access in a // comment is not reported', () => {
  const findings = scan(
    goodPage({
      head: [
        '<title>x</title>',
        '<script>',
        "  // localStorage.getItem('example-theme') used to run here",
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('masking // comments does not swallow the rest of a line holding a URL', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<script>',
        "  const endpoint = 'https://api.example.com/x';",
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['external-resource']);
  assert.match(findings[0].message, /api\.example\.com/);
});

test('a manifest whose attributes are ordered id-then-type is found', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script id="example-manifest" type="application/json">',
        '{ "note": "x" }',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a second manifest block is validated too', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{ "a": 1 }</script>',
        '<script type="application/json" id="second-manifest">{ broken ]</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['manifest-invalid']);
  assert.match(findings[0].message, /second-manifest/);
});

// `checkManifest` parses the raw body at the offsets it located in the masked
// code. Both halves of that split are asserted below: parsing must survive JS
// comment syntax quoted inside JSON, and the masking that protects every *other*
// rule must stay in force over the same block. A citation anchor quotes source
// verbatim (ADR 0085), so `release-pipeline.html` carries both byte pairs today.

test('a glob and a later */ in a manifest do not blank what lies between them', () => {
  // The failure this guards against is silent: the blanked span still parses as
  // JSON, with "guard" truncated and "close" gone entirely.
  const manifest = [
    '<script type="application/json" id="example-manifest">',
    '{ "guard": "refs/heads/release/*", "close": "ends with */ here" }',
    '</script>',
  ].join('\n');
  assert.deepEqual(rules(scan(goodPage({ manifest }))), []);
});

test('a quoted // inside a manifest string does not blank the rest of its line', () => {
  // Here the blanking ran to end of line, taking the closing quote and brace with
  // it, so the block stopped parsing at all.
  const manifest = [
    '<script type="application/json" id="example-manifest">',
    '{ "quoted": "// command === \'tag\'", "note": "asserted" }',
    '</script>',
  ].join('\n');
  assert.deepEqual(rules(scan(goodPage({ manifest }))), []);
});

test('a manifest block cannot answer a presence rule with text it only quotes', () => {
  // The other direction of the same split, and the reason the exemption does not
  // live in `maskHtmlComments`: that function feeds every rule, and two of them
  // are satisfied by presence. A page whose stylesheet has no dark pin must still
  // fail even when its manifest quotes one inside a comment span.
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root {',
        '  --ink: #101010;',
        '}',
        '@media (prefers-color-scheme: dark) {',
        "  :root:not([data-theme='light']) {",
        '    --ink: #f0f0f0;',
        '  }',
        '}',
        '</style>',
      ].join('\n'),
      manifest: [
        '<script type="application/json" id="example-manifest">',
        '{ "anchor": "/* :root[data-theme=\'dark\'] { --ink: #f0f0f0; } */" }',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['theme-tokens-incomplete']);
});

test('a JSON block that is not a manifest does not satisfy the manifest rule', () => {
  // `citation-anchors` is the first `application/json` block on a page that
  // asserts nothing. Counting it would let a page carrying no manifest pass the
  // check whose own message names the block it wants.
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="citation-anchors">',
        '{ "anchors": {} }',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['manifest-missing']);
});

test('a non-manifest JSON block is still parsed for validity', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{ "a": 1 }</script>',
        '<script type="application/json" id="citation-anchors">{ broken ]</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['manifest-invalid']);
  assert.match(findings[0].message, /citation-anchors/);
});

test('a manifest inside an HTML comment does not count as one', () => {
  // Blocks are located in the masked code precisely so this stays true; reading
  // the raw source for the body must not smuggle a commented-out block back in.
  const findings = scan(
    goodPage({
      manifest: [
        '<!--',
        '<script type="application/json" id="example-manifest">{ "a": 1 }</script>',
        '-->',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['manifest-missing']);
});

test('a comment in an ordinary script is still masked', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<script>',
        "  // localStorage.getItem('x') is discussed, not called",
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('an @font-face inside an HTML comment cannot shift the hashed slice', () => {
  const commented = goodPage({
    style: [
      '<style>',
      '<!-- @font-face { font-family: Ghost; src: url(data:font/woff2;base64,ZZZZ); } -->',
      '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
      ':root { --ink: #101010; }',
      '@media (prefers-color-scheme: dark) {',
      "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
      '}',
      ":root[data-theme='dark'] { --ink: #f0f0f0; }",
      '</style>',
    ].join('\n'),
  });
  assert.equal(fontBlockHash(commented), fontBlockHash(goodPage()));
});

test('an http URL named only in a comment is not a finding', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">{}</script>',
        '<!-- Fonts were originally fetched from https://fonts.googleapis.com. -->',
        '<script>',
        '  /* see https://example.com/rfc for why */',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('an SVG xmlns namespace URI is not an external resource', () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a url() pointing at an http origin is reported', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; background: url(https://cdn.example.com/x.png); }',
        '@media (prefers-color-scheme: dark) {',
        "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
        '}',
        ":root[data-theme='dark'] { --ink: #f0f0f0; }",
        '</style>',
      ].join('\n'),
    }),
  );
  assert.ok(rules(findings).includes('external-resource'));
});

// --- theme-tokens-incomplete -------------------------------------------------

test('a missing bare :root block is reported', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        '@media (prefers-color-scheme: dark) {',
        "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
        '}',
        ":root[data-theme='dark'] { --ink: #f0f0f0; }",
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['theme-tokens-incomplete']);
  assert.match(findings[0].message, /:root/);
});

test('an unguarded prefers-color-scheme block is reported', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; }',
        '@media (prefers-color-scheme: dark) {',
        '  :root { --ink: #f0f0f0; }',
        '}',
        ":root[data-theme='dark'] { --ink: #f0f0f0; }",
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['theme-tokens-incomplete']);
  assert.match(findings[0].message, /data-theme='light'/);
});

test('a missing [data-theme=dark] block is reported', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; }',
        '@media (prefers-color-scheme: dark) {',
        "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
        '}',
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['theme-tokens-incomplete']);
  assert.match(findings[0].message, /data-theme='dark'/);
});

test('a guard far inside a long dark block still satisfies the rule', () => {
  const filler = Array.from(
    { length: 40 },
    (_, i) => `  .filler-${i} { margin: 0; }`,
  ).join('\n');
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; }',
        '@media (prefers-color-scheme: dark) {',
        filler,
        "  :root:not([data-theme='light']) { --ink: #f0f0f0; }",
        '}',
        ":root[data-theme='dark'] { --ink: #f0f0f0; }",
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a guard belonging to a later block does not satisfy this one', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; }',
        '@media (prefers-color-scheme: dark) {',
        '  :root { --ink: #f0f0f0; }',
        '}',
        "@media print { :root:not([data-theme='light']) { --ink: #000; } }",
        ":root[data-theme='dark'] { --ink: #f0f0f0; }",
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['theme-tokens-incomplete']);
  assert.match(findings[0].message, /data-theme='light'/);
});

test('double-quoted theme selectors satisfy the three-state rule', () => {
  const findings = scan(
    goodPage({
      style: [
        '<style>',
        '@font-face { font-family: Caprasimo; src: url(data:font/woff2;base64,AAAA); }',
        ':root { --ink: #101010; }',
        '@media (prefers-color-scheme: dark) {',
        '  :root:not([data-theme="light"]) { --ink: #f0f0f0; }',
        '}',
        ':root[data-theme="dark"] { --ink: #f0f0f0; }',
        '</style>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

// --- unguarded-storage -------------------------------------------------------

test('a localStorage read outside a try block is reported', () => {
  const findings = scan(
    goodPage({
      head: [
        '<title>x</title>',
        '<script>',
        "  const t = localStorage.getItem('example-theme');",
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['unguarded-storage']);
});

test('a localStorage access nested inside a try block is not reported', () => {
  const findings = scan(
    goodPage({
      head: [
        '<title>x</title>',
        '<script>',
        '  try {',
        '    if (pin) {',
        "      localStorage.setItem('example-theme', pin);",
        '    } else {',
        "      localStorage.removeItem('example-theme');",
        '    }',
        '  } catch (e) {}',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

test('a localStorage access in a sibling block of a try is still reported', () => {
  const findings = scan(
    goodPage({
      head: [
        '<title>x</title>',
        '<script>',
        '  try {',
        '    probe();',
        '  } catch (e) {}',
        '  if (pin) {',
        "    localStorage.setItem('example-theme', pin);",
        '  }',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['unguarded-storage']);
});

test('a localStorage write inside a try block is not reported', () => {
  const findings = scan(
    goodPage({
      head: [
        '<title>x</title>',
        '<script>',
        '  try {',
        "    localStorage.setItem('example-theme', 'dark');",
        '  } catch (e) {}',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), []);
});

// --- manifest-missing --------------------------------------------------------

test('a page with no embedded JSON manifest is reported', () => {
  const findings = scan(goodPage({ manifest: '' }));
  assert.deepEqual(rules(findings), ['manifest-missing']);
});

test('a manifest that is not valid JSON is reported', () => {
  const findings = scan(
    goodPage({
      manifest: [
        '<script type="application/json" id="example-manifest">',
        '{ not json ]',
        '</script>',
      ].join('\n'),
    }),
  );
  assert.deepEqual(rules(findings), ['manifest-invalid']);
});

// --- prettier-ignore-missing -------------------------------------------------

test('a page absent from .prettierignore is reported', () => {
  const findings = scan(goodPage(), { prettierIgnored: false });
  assert.deepEqual(rules(findings), ['prettier-ignore-missing']);
});

// --- adr-link-broken ---------------------------------------------------------

test('a relative ADR link that does not resolve is reported', () => {
  const findings = scan(goodPage(), { adrLinkExists: () => false });
  assert.deepEqual(rules(findings), ['adr-link-broken']);
  assert.match(findings[0].message, /0043-gates-assert-facts\.md/);
});

test('the ADR link is resolved relative to the page directory', () => {
  const seen = [];
  scan(goodPage(), {
    adrLinkExists: (resolved) => {
      seen.push(resolved);
      return true;
    },
  });
  assert.deepEqual(seen, ['docs/adr/0043-gates-assert-facts.md']);
});

test('an ADR link carrying a fragment is resolved without the fragment', () => {
  const seen = [];
  scan(
    goodPage({
      body: '<a href="../adr/0043-gates-assert-facts.md#decision">ADR</a>',
    }),
    {
      adrLinkExists: (resolved) => {
        seen.push(resolved);
        return true;
      },
    },
  );
  assert.deepEqual(seen, ['docs/adr/0043-gates-assert-facts.md']);
});

// --- citation-unresolved -------------------------------------------------------
//
// A citation is discovered by findCitations regardless of which element carries
// it, so each markup-form test asserts on discovery (via a recording resolver)
// rather than on the wrapping tag.

function recordingResolver(result = { ok: true }) {
  const seen = [];
  const resolveCitation = (citation) => {
    seen.push(citation);
    return result;
  };
  return { seen, resolveCitation };
}

test('a class="cite" span citation is discovered', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<span class="cite">ci.yml:3-12</span>',
    }),
    { resolveCitation },
  );
  assert.equal(seen.length, 1);
  assert.deepEqual(
    [seen[0].name, seen[0].line, seen[0].endLine],
    ['ci.yml', 3, 12],
  );
});

test('a class="src" span carrying several bare citations is discovered as one name and three lines', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<span class="src">deploy-production.yml:128, :181, :293</span>',
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['deploy-production.yml', 128, 128],
      ['deploy-production.yml', 181, 181],
      ['deploy-production.yml', 293, 293],
    ],
  );
});

test('an inline <code> citation carrying a path is discovered', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: '<p>Table at <code>docs/adr/0012-tiered-quality-gates.md:17-19</code>.</p>',
    }),
    { resolveCitation },
  );
  assert.equal(seen.length, 1);
  assert.deepEqual(
    [seen[0].name, seen[0].line, seen[0].endLine],
    ['docs/adr/0012-tiered-quality-gates.md', 17, 19],
  );
});

test('an SVG label-text citation is discovered', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x">',
        '  <text class="src" x="52" y="130">SKILL.md:25</text>',
        '</svg>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.equal(seen.length, 1);
  assert.deepEqual(
    [seen[0].name, seen[0].line, seen[0].endLine],
    ['SKILL.md', 25, 25],
  );
});

test('a table-cell citation is discovered', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<table><tbody><tr><td class="cite">release-pr.yml:4-6, :103-115</td></tr></tbody></table>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['release-pr.yml', 4, 6],
      ['release-pr.yml', 103, 115],
    ],
  );
});

test('a bare :NNN several lines below still resolves to the filename named earlier', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p><code>deploy-staging.yml:9-12</code> triggers the deploy.</p>',
        '<p>Fully applied only once the wait job clears</p>',
        '<p>(<code>:29</code>).</p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['deploy-staging.yml', 9, 12],
      ['deploy-staging.yml', 29, 29],
    ],
  );
});

test('a class="src" caption naming a file with no line still sets the context for a later bare citation', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<span class="src">what &#8220;green&#8221; means before a deploy &middot; ci.yml</span>',
        '<p>Lint <code>:412</code></p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [['ci.yml', 412, 412]],
  );
});

test('a code-shaped token outside a class="src" caption does not steal context from the last real citation', () => {
  // github.ref reads as a dotted name exactly like a filename does. The real
  // defect this guards: the bare :88 that follows is a line in the file the list
  // is actually about (deploy-production.yml), not in "github.ref".
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p><code>deploy-production.yml:1</code> guards the job.</p>',
        '<p>It tests <code>github.ref</code> <span class="cite">:88</span>.</p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['deploy-production.yml', 1, 1],
      ['deploy-production.yml', 88, 88],
    ],
  );
});

test('a known-extension mention immediately beside its bare citations sets the context', () => {
  // The real defect this guards: session-lifecycle.html writes "Four secrets in
  // ApiTokens.ts (:36 access, :41 refresh, :26 verify, :16 reset)" — a plain
  // <code> mention, not a class="src" caption, immediately followed by four bare
  // citations. Without this, they were misattributed to whatever file was last
  // fully cited, sometimes an unrelated file several screens above.
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p>Four secrets in <code>ApiTokens.ts</code> (<span class="cite">:36</span> access,',
        '<span class="cite">:41</span> refresh).</p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['ApiTokens.ts', 36, 36],
      ['ApiTokens.ts', 41, 41],
    ],
  );
});

test('a known-extension mention a whole clause away from its citation does not set the context', () => {
  // RELEASE_NOTES.md is a real file with a real extension, but the bare citation
  // that follows belongs to the file named earlier in the sentence
  // (publish-github-release.yml), not to RELEASE_NOTES.md — there is a full
  // clause of prose between the mention and the citation, not just punctuation.
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p><code>publish-github-release.yml:4-6</code>. Reads',
        '<code>RELEASE_NOTES.md</code> from the tagged commit and creates the',
        'release, so re-running it is safe (<span class="cite">:79-100</span>).</p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['publish-github-release.yml', 4, 6],
      ['publish-github-release.yml', 79, 100],
    ],
  );
});

test('a slash-shaped prose token (a branch pattern, not a file) does not become a citation name', () => {
  // release/vX.Y.Z is a git ref pattern in prose, not a file — it has the same
  // word/word shape a real path citation does.
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p><code>deploy-production.yml:40-50</code> resolves the newest',
        'release/vX.Y.Z by sort -V <span class="cite">:71-85</span>.</p>',
      ].join('\n'),
    }),
    { resolveCitation },
  );
  assert.deepEqual(
    seen.map((c) => [c.name, c.line, c.endLine]),
    [
      ['deploy-production.yml', 40, 50],
      ['deploy-production.yml', 71, 85],
    ],
  );
});

test('a bare :NNN with no filename named earlier on the page is not a citation', () => {
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<p>See <code>:29</code> above.</p>',
    }),
    { resolveCitation },
  );
  assert.deepEqual(seen, []);
});

test('an unresolved citation is reported with the resolver reason', () => {
  const findings = scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<span class="cite">ghost.yml:5</span>',
    }),
    {
      resolveCitation: () => ({
        ok: false,
        reason: 'ghost.yml:5 cites a file that does not exist in the tree.',
      }),
    },
  );
  assert.deepEqual(rules(findings), ['citation-unresolved']);
  assert.match(findings[0].message, /ghost\.yml/);
});

test('a resolved citation produces no finding', () => {
  const findings = scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<span class="cite">ci.yml:3-12</span>',
    }),
    { resolveCitation: () => ({ ok: true }) },
  );
  assert.deepEqual(rules(findings), []);
});

test("the finding lands on the citation's own line, not line 1", () => {
  const findings = scan(
    goodPage({
      body: [
        '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>',
        '<p>filler</p>',
        '<span class="cite">ghost.yml:5</span>',
      ].join('\n'),
    }),
    { resolveCitation: () => ({ ok: false, reason: 'nope' }) },
  );
  // head is 10 lines, style 14: body starts at line 25, and the cite span is the
  // third body line.
  assert.equal(findings[0].line, 27);
});

test('findCitations is a pure discovery function usable without scanDesignPage', () => {
  const citations = findCitations('<span class="cite">ci.yml:3-12</span>');
  assert.equal(citations.length, 1);
  assert.equal(citations[0].name, 'ci.yml');
});

test('a citation inside a <style> or <script> block is not discovered', () => {
  // opacity:0 / opacity:1 in a CSS keyframe is not a citation — the real defect
  // this guards: :root's dark palette selector shares the digit-after-colon shape
  // with a citation, and an @keyframes block writes exactly this pattern.
  const { seen, resolveCitation } = recordingResolver();
  scan(
    goodPage({
      body: '<svg viewBox="0 0 10 10" role="img" aria-label="x"></svg>\n<style>@keyframes pop { from { opacity:0; } to { opacity:1; } }</style>',
    }),
    { resolveCitation },
  );
  assert.deepEqual(seen, []);
});

test('RULE_KINDS classifies every citation rule as factual-assertion and the rest as mechanical-hygiene', () => {
  // All three are what a LEGACY page still has to face: resolution alone catches
  // none of the drift #771 corrected, so the anchor rules are factual too.
  const factual = Object.entries(RULE_KINDS)
    .filter(([, kind]) => kind === 'factual-assertion')
    .map(([rule]) => rule)
    .sort();
  assert.deepEqual(factual, [
    'citation-anchor-mismatch',
    'citation-anchor-unreadable',
    'citation-missing-anchor',
    'citation-unresolved',
  ]);
  const mechanical = Object.entries(RULE_KINDS)
    .filter(([rule]) => !factual.includes(rule))
    .map(([, kind]) => kind);
  assert.ok(mechanical.every((kind) => kind === 'mechanical-hygiene'));
});

test('RULE_KINDS has exactly one entry per rule name this module can actually emit', () => {
  // A rule added to a check* function and wired into scanDesignPage but never
  // added here would run over ROSTER pages with no kind — silently exempt from
  // nothing, included in nothing's exemption boundary — and nothing would fail.
  // Reading the rule names back out of the module's own source is what catches
  // that drift instead of trusting this list to stay hand-in-sync with it.
  const source = readFileSync(SCAN_MODULE_SOURCE, 'utf8');
  const emitted = new Set(
    [...source.matchAll(/rule: '([\w-]+)'/g)].map((m) => m[1]),
  );
  assert.deepEqual([...emitted].sort(), Object.keys(RULE_KINDS).sort());
});

test('scanFactualAssertions runs only citation resolution, even on a page with other defects', () => {
  // Not a house page at all — no font block, no manifest, a <title> inside an
  // <svg>. None of that may surface here; that is what makes a page eligible for
  // the LEGACY exemption safe to still run this against (ADR 0085).
  const source = [
    '<svg role="img"><title>Bad</title></svg>',
    '<span class="cite">ghost.yml:5</span>',
  ].join('\n');
  const findings = scanFactualAssertions({
    source,
    resolveCitation: () => ({ ok: false, reason: 'ghost.yml:5 is missing.' }),
  });
  assert.deepEqual(rules(findings), ['citation-unresolved']);
});

test('scanFactualAssertions reports nothing when the page has no citations', () => {
  const findings = scanFactualAssertions({
    source: '<p>No sources cited here.</p>',
    resolveCitation: () => ({ ok: false, reason: 'should never be called' }),
  });
  assert.deepEqual(findings, []);
});

// --- helpers -----------------------------------------------------------------

test('maskHtmlComments preserves offsets and line numbers', () => {
  const source = 'a\n<!-- hidden\nlines -->\nb';
  const masked = maskHtmlComments(source);
  assert.equal(masked.length, source.length);
  assert.equal(masked.split('\n').length, source.split('\n').length);
  assert.ok(!masked.includes('hidden'));
  assert.ok(masked.startsWith('a\n'));
  assert.ok(masked.endsWith('\nb'));
});

test('maskHtmlComments also blanks script and style block comments', () => {
  // The comment sits inside a <style>, which is what this test has always been
  // named for. It previously passed a bare `/* … */` with no element around it,
  // and passed only because masking ran document-wide — the defect that let a
  // glob in prose blank the rest of a page. In prose those bytes are not a
  // comment, and `a glob in prose does not hide…` in check-design-hygiene.test.mjs
  // asserts that directly.
  const source = 'a\n<style>/* hidden\nlines */</style>\nb';
  const masked = maskHtmlComments(source);
  assert.equal(masked.length, source.length);
  assert.ok(!masked.includes('hidden'));
  assert.ok(masked.endsWith('\nb'));
});

test('fontBlockHash slices from the first @font-face to the last rule close', () => {
  const source = [
    'prefix',
    '@font-face { font-family: A; src: url(data:x); }',
    '',
    '@font-face { font-family: B; src: url(data:y); }',
    'suffix',
  ].join('\n');
  const hash = fontBlockHash(source);
  assert.match(hash, /^[0-9a-f]{64}$/);
  // Prefix and suffix are outside the slice, so changing them cannot move the hash.
  assert.equal(
    fontBlockHash(source.replace('prefix', 'other').replace('suffix', 'end')),
    hash,
  );
  // A change inside the block must move it.
  assert.notEqual(fontBlockHash(source.replace('font-family: B', 'C')), hash);
});

test('fontBlockHash normalises CRLF so a checkout setting cannot move the hash', () => {
  const source = '@font-face {\n  font-family: A;\n}\n';
  assert.equal(
    fontBlockHash(source.split('\n').join('\r\n')),
    fontBlockHash(source),
  );
});

test('fontBlockHash returns null when the page carries no @font-face', () => {
  assert.equal(fontBlockHash('<style>:root{}</style>'), null);
});
