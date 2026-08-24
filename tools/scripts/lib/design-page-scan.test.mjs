import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fontBlockHash,
  maskHtmlComments,
  scanDesignPage,
} from './design-page-scan.mjs';

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
