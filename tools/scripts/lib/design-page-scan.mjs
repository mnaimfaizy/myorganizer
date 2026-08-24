/**
 * Mechanical checks for House Explainer Pages — the self-contained HTML artifacts
 * the Designer sub-agent produces (`.github/agents/designer.agent.md`).
 *
 * This module is pure: every filesystem fact it needs is passed in. The CLI that
 * reads those facts is `tools/scripts/check-design-hygiene.mjs`.
 *
 * Each rule here exists because a real dispatch got it wrong, and because a model
 * asked to confirm "the page has no root-svg <title>" will glance at it and say
 * yes. See docs/adr/0046-house-explainer-pages-have-a-designer-and-a-gate.md.
 *
 * Deliberately NOT checked here — judgment, and the reason a human still reads
 * the page: whether the hero is the right hero, whether a panel earns its place,
 * whether the prose is true. An Assertion Gate compares two artifacts (ADR 0043);
 * "is this diagram clear" compares an artifact to a feeling.
 */

import { createHash } from 'node:crypto';

import { blockAfter, lineOf } from './source-scan.mjs';

const blank = (match) => match.replace(/[^\n]/g, ' ');

/**
 * Replaces every comment with spaces, keeping newlines so offsets and line numbers
 * survive. Both flavours matter: these pages explain their own rules in prose, in
 * HTML comments around the markup and in `/* … *\/` comments inside the inline
 * script. `gates.html` writes "a root-`<svg>` `<title>` is not a tooltip system"
 * in a script comment, and scanning raw source reports that warning as the very
 * violation it warns about.
 */
export function maskHtmlComments(source) {
  return (
    source
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      // `//` only where a colon does not precede it, so `https://` survives intact.
      // Without this pass a commented-out `localStorage.` reported as unguarded.
      .replace(
        /(^|[^:])(\/\/[^\n]*)/g,
        (_, before, comment) => before + blank(comment),
      )
  );
}

/**
 * Blanks the bodies of `<script>` and `<style>` while keeping their tags, for the
 * checks that are about markup rather than about code. Without it, a script that
 * mentions `<svg>` in a string or builds markup by concatenation moves the tag
 * scanner's depth counter and every later `<title>` looks nested.
 */
function maskEmbeddedCode(source) {
  return source.replace(
    /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
    (_, open, __, body, close) => `${open}${blank(body)}${close}`,
  );
}

/**
 * The page's `@font-face` block, sliced from the first `@font-face` to the closing
 * brace of the last `@font-face` rule and normalised to LF. Null when there is none.
 *
 * The slicing convention is the point of this function. Three separate dispatches
 * burned effort brute-forcing which bytes a quoted hash covered, because the brief
 * named a hash without naming the slice. Nobody agrees on a literal: pages are
 * compared, and spliced, through this one implementation.
 */
export function fontBlock(source) {
  // Comments are masked before the ends are located, so an `@font-face` named in
  // prose cannot move either one. Masking preserves offsets, so the slice is taken
  // from the raw source and the caller still gets bytes it can splice verbatim.
  const masked = maskHtmlComments(source);
  const first = masked.indexOf('@font-face');
  if (first === -1) return null;

  const last = masked.lastIndexOf('@font-face');
  const open = masked.indexOf('{', last);
  const lastRule = blockAfter(masked, last);
  if (open === -1 || !lastRule.endsWith('}')) return null;

  return source
    .slice(first, open + lastRule.length)
    .split('\r\n')
    .join('\n');
}

/** SHA-256 of `fontBlock(source)`, or null when the page carries no block. */
export function fontBlockHash(source) {
  const block = fontBlock(source);
  return block === null
    ? null
    : createHash('sha256').update(block).digest('hex');
}

// --- rules -------------------------------------------------------------------

/**
 * A `<title>` inside an `<svg>` is the accessible-name pattern every reference
 * recommends and the one that shipped a defect: browsers also render it as a
 * native tooltip, so a full-canvas diagram grows a tooltip covering the canvas.
 * The house pattern is `aria-label` for the name and `aria-describedby` → `<desc>`
 * for the long description, which produces no tooltip.
 *
 * Scans tags in document order with an `<svg>` depth counter, so the document
 * `<title>` (depth 0) is fine and a nested `<svg>` is still caught.
 */
function checkSvgTitles(code, findings) {
  const tags = code.matchAll(/<(\/?)(svg|title)\b([^>]*)>/gi);
  let depth = 0;
  for (const tag of tags) {
    const closing = tag[1] === '/';
    const name = tag[2].toLowerCase();
    const attrs = tag[3] ?? '';

    if (name === 'svg') {
      if (closing) depth = Math.max(0, depth - 1);
      else if (!attrs.trimEnd().endsWith('/')) depth++;
      continue;
    }
    if (!closing && depth > 0) {
      findings.push({
        rule: 'svg-title-tooltip',
        line: lineOf(code, tag.index),
        message:
          '<title> inside an <svg> renders as a native tooltip covering the whole canvas. Use aria-label for the name and aria-describedby → <desc> for the description.',
      });
    }
  }
}

/**
 * The Popover reads its text from static "Diagram notes" entries rather than from
 * strings embedded in the shapes, so a shape and its note are two halves of one
 * fact. An orphan in either direction is a shape that opens an empty popover or a
 * note no reader can reach.
 */
function checkTipNoteBijection(code, findings) {
  const tips = new Map();
  for (const m of code.matchAll(/data-tip="([^"]+)"/g)) {
    if (!tips.has(m[1])) tips.set(m[1], lineOf(code, m.index));
  }
  const notes = new Map();
  for (const m of code.matchAll(/id="note-([^"]+)"/g)) {
    if (!notes.has(m[1])) notes.set(m[1], lineOf(code, m.index));
  }

  for (const [key, line] of tips) {
    if (!notes.has(key)) {
      findings.push({
        rule: 'tip-note-bijection',
        line,
        message: `data-tip="${key}" has no matching #note-${key} entry — the shape opens an empty popover.`,
      });
    }
  }
  for (const [key, line] of notes) {
    if (!tips.has(key)) {
      findings.push({
        rule: 'tip-note-bijection',
        line,
        message: `#note-${key} has no matching data-tip="${key}" shape — no reader can reach it.`,
      });
    }
  }
}

/**
 * Self-containment. The pages preview from `file://` and inside sandboxes with no
 * network, so anything fetched at load is a blank region for some reader.
 *
 * Every `http(s)://` literal is reported, not only the ones in `src`/`href`/`url()`.
 * An attribute-shaped rule passes a bare `fetch('https://…')` or a dynamic
 * `import()` in the inline script, which is the same defect reached by a different
 * spelling.
 *
 * Two exemptions, both because they load nothing: XML namespace URIs, which are
 * declarations; and `<a href>`, because a link the reader chooses to follow is
 * navigation, and an explainer page citing the spec it explains is doing its job.
 * A bare URL sitting in prose is still reported — it should have been an anchor.
 */
function checkExternalResources(code, findings) {
  // A `<link href="https://…">` is one defect with one fix. Reporting it as both
  // a <link> and a remote href would double the count and make the total lie about
  // how much is wrong, so the tags are blanked before the URL scan runs.
  let rest = code;
  const erase = (at, text) =>
    (rest = rest.slice(0, at) + blank(text) + rest.slice(at + text.length));

  for (const m of code.matchAll(/<link\b[^>]*>/gi)) {
    findings.push({
      rule: 'external-resource',
      line: lineOf(code, m.index),
      message:
        '<link> loads an external stylesheet or asset. House pages inline everything.',
    });
    erase(m.index, m[0]);
  }
  for (const m of code.matchAll(/<a\b[^>]*>/gi)) erase(m.index, m[0]);
  for (const m of code.matchAll(/@import\b/g)) {
    findings.push({
      rule: 'external-resource',
      line: lineOf(code, m.index),
      message:
        '@import fetches a stylesheet at load. Inline the rules instead.',
    });
  }
  for (const m of rest.matchAll(/https?:\/\/[^\s"'`)<>\\]+/gi)) {
    const url = m[0];
    if (/^https?:\/\/(?:www\.)?w3\.org\//.test(url)) continue; // xmlns / xlink declarations
    findings.push({
      rule: 'external-resource',
      line: lineOf(code, m.index),
      message: `${url} is an external URL. House pages are self-contained — inline it as a data: URI, or drop it.`,
    });
  }
}

/**
 * Theme tokens live in three states because the viewer's setting has three:
 * an explicit light pin, an explicit dark pin, and the system default. Defining
 * dark only under `@media` loses the toggle; defining it only under `[data-theme]`
 * loses the system default; an unguarded `@media` block beats an explicit light pin.
 */
function checkThemeTokens(code, findings) {
  const missing = [];
  if (!/(^|[\s{}]):root\s*\{/m.test(code)) {
    missing.push(
      'a bare `:root { … }` block — the light palette every other state overrides',
    );
  }
  const media = code.match(
    /@media\s*\([^)]*prefers-color-scheme:\s*dark[^)]*\)/,
  );
  if (!media) {
    missing.push(
      '`@media (prefers-color-scheme: dark)` — the system-default dark palette',
    );
  } else {
    // The block's real extent, not a fixed window. A guessed character count both
    // missed a guard sitting past a long comment and accepted one that belonged to
    // a later, unrelated at-rule.
    const body = blockAfter(code, media.index);
    if (!/:root:not\(\[data-theme=['"]light['"]\]\)/.test(body)) {
      missing.push(
        "a `:root:not([data-theme='light'])` guard on the prefers-color-scheme block — without it the system setting overrides an explicit light pin",
      );
    }
  }
  if (!/:root\[data-theme=['"]dark['"]\]/.test(code)) {
    missing.push(
      "a `:root[data-theme='dark']` block — the explicit dark pin the toggle sets",
    );
  }

  for (const item of missing) {
    findings.push({
      rule: 'theme-tokens-incomplete',
      line: 1,
      message: `Theme tokens are incomplete: missing ${item}.`,
    });
  }
}

/**
 * Storage access throws `SecurityError` on an opaque origin — a `data:` URL, a
 * sandboxed iframe, some `file://` configurations — and these pages are read from
 * exactly those. An uncaught throw in the pre-paint theme block kills the rest of
 * it and the page loads unstyled.
 */
function checkStorageGuards(code, findings) {
  for (const m of code.matchAll(/\blocalStorage\s*\./g)) {
    if (!insideTry(code, m.index)) {
      findings.push({
        rule: 'unguarded-storage',
        line: lineOf(code, m.index),
        message:
          'localStorage access outside a try/catch. It throws SecurityError on an opaque origin (file://, sandboxed iframe), and these pages are read from there.',
      });
    }
  }
}

/**
 * True when `index` sits inside a `try { … }` block, at any nesting depth.
 *
 * Walks outward through every enclosing block rather than stopping at the innermost
 * one. The theme toggle's real shape is `try { if (pin) { … } else { … } } catch`,
 * so checking only the immediately enclosing block called a correct guard unguarded.
 */
function insideTry(code, index) {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const ch = code[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        // An enclosing block opener. If `try` introduces it we are done; otherwise
        // keep walking out through its own enclosing blocks.
        if (/\btry\s*$/.test(code.slice(Math.max(0, i - 12), i))) return true;
      } else {
        depth--;
      }
    }
  }
  return false;
}

/**
 * The embedded manifest is what lets a check script diff the page's claims against
 * the source constants later. Without one the page starts rotting the day it lands
 * and nobody finds out (design-brief/SKILL.md, step 6).
 */
function checkManifest(code, findings) {
  // Attribute order is not fixed by anything, so matching `type` before `id` made a
  // perfectly good manifest report as missing. Every JSON block is parsed, not just
  // the first — a page carrying two and breaking the second would have passed.
  let found = 0;
  for (const m of code.matchAll(
    /<script\b([^>]*\btype="application\/json"[^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    found++;
    const id = m[1].match(/\bid="([^"]+)"/)?.[1] ?? '(no id)';
    try {
      JSON.parse(m[2]);
    } catch (err) {
      findings.push({
        rule: 'manifest-invalid',
        line: lineOf(code, m.index),
        message: `#${id} is not valid JSON: ${err.message}`,
      });
    }
  }
  if (found === 0) {
    findings.push({
      rule: 'manifest-missing',
      line: 1,
      message:
        'No embedded <script type="application/json" id="…-manifest"> block. Without one, nothing can assert the page against the source it describes.',
    });
  }
}

/**
 * These pages are hand-tuned markup with meaningful whitespace inside <pre> and
 * inline SVG. Prettier reflows them, so an unlisted page is rewritten on the next
 * commit that touches anything.
 */
function checkPrettierIgnored(file, prettierIgnored, findings) {
  if (prettierIgnored) return;
  findings.push({
    rule: 'prettier-ignore-missing',
    line: 1,
    message: `${file} is not listed in .prettierignore — formatting will reflow its hand-tuned markup.`,
  });
}

/**
 * A page that cites an ADR by relative path is only as good as the path. ADR files
 * get renumbered before they merge (ADR 0042), which is exactly when these links
 * break.
 */
function checkAdrLinks(file, code, adrLinkExists, findings) {
  const dir = file.split('/').slice(0, -1).join('/');
  for (const m of code.matchAll(/(?:href|src)="([^"]*adr\/[^"]+)"/g)) {
    const raw = m[1];
    if (/^[a-z]+:/i.test(raw)) continue; // absolute URL — checkExternalResources owns it
    const target = raw.split('#')[0].split('?')[0];
    const resolved = resolveRelative(dir, target);
    if (!adrLinkExists(resolved)) {
      findings.push({
        rule: 'adr-link-broken',
        line: lineOf(code, m.index),
        message: `${raw} does not resolve (${resolved}). ADRs are renumbered before they merge — re-check the number.`,
      });
    }
  }
}

function resolveRelative(dir, target) {
  const segments = target.startsWith('/')
    ? target.slice(1).split('/')
    : [...dir.split('/').filter(Boolean), ...target.split('/')];
  const out = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

// --- entry point -------------------------------------------------------------

/**
 * Runs every rule over one House Explainer Page.
 *
 * @param {object} input
 * @param {string} input.file              repo-relative POSIX path, used in messages and to resolve links
 * @param {string} input.source            the page's raw text
 * @param {string} input.canonicalFontHash `fontBlockHash` of the canonical page
 * @param {string|null} input.pageFontHash `fontBlockHash` of this page
 * @param {boolean} input.prettierIgnored  whether .prettierignore covers this file
 * @param {(resolved: string) => boolean} input.adrLinkExists
 * @returns {Array<{rule: string, line: number, message: string}>} findings, in file order
 */
export function scanDesignPage({
  file,
  source,
  canonicalFontHash,
  pageFontHash,
  prettierIgnored,
  adrLinkExists,
}) {
  const code = maskHtmlComments(source);
  const findings = [];

  checkSvgTitles(maskEmbeddedCode(code), findings);
  checkTipNoteBijection(code, findings);
  checkExternalResources(code, findings);
  checkThemeTokens(code, findings);
  checkStorageGuards(code, findings);
  checkManifest(code, findings);
  checkPrettierIgnored(file, prettierIgnored, findings);
  checkAdrLinks(file, code, adrLinkExists, findings);

  if (pageFontHash === null) {
    findings.push({
      rule: 'font-block-drift',
      line: 1,
      message:
        'The page carries no @font-face block, so its typography falls back to system stacks while every sibling page uses the house faces.',
    });
  } else if (pageFontHash !== canonicalFontHash) {
    findings.push({
      rule: 'font-block-drift',
      line: 1,
      message: `The @font-face block differs from the canonical page (${pageFontHash.slice(0, 12)}… vs ${canonicalFontHash.slice(0, 12)}…). Splice the block across verbatim; do not re-encode or re-subset it.`,
    });
  }

  return findings.sort((a, b) => a.line - b.line);
}
