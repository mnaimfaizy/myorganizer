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
 *
 * Rules are classified by kind (`RULE_KINDS`, ADR 0085). Every rule above the
 * citation rule is mechanical-hygiene: the `LEGACY` roster exempts a page from
 * these on the strength of one written reason. `checkCitations` is the one
 * factual-assertion rule today — it asserts that a citation resolves, which is
 * necessary and not sufficient (see its own comment) — and `LEGACY` does not
 * exempt a page from it: `scanDesignPage` runs everything for a `ROSTER` page,
 * `scanFactualAssertions` runs only this for a `LEGACY` one.
 */

import { createHash } from 'node:crypto';

import { blockAfter, lineOf } from './source-scan.mjs';

const blank = (match) => match.replace(/[^\n]/g, ' ');

/** Rewrites the body of every `<script>` and `<style>`, leaving markup untouched. */
function mapEmbeddedCode(source, transform) {
  return source.replace(
    /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
    (_, open, __, body, close) => `${open}${transform(body)}${close}`,
  );
}

/**
 * Masks `/* … *\/` and `//` comments. Scoped to code, because in prose those byte
 * pairs are not comments at all.
 */
function maskCodeComments(code) {
  return (
    code
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
 * Replaces every comment with spaces, keeping newlines so offsets and line numbers
 * survive. Both flavours matter: these pages explain their own rules in prose, in
 * HTML comments around the markup and in `/* … *\/` comments inside the inline
 * script. `gates.html` writes "a root-`<svg>` `<title>` is not a tooltip system"
 * in a script comment, and scanning raw source reports that warning as the very
 * violation it warns about.
 *
 * The code flavours are masked only inside `<script>` and `<style>`, and that scope
 * is the whole point. Applied document-wide, a glob in prose — `release/*`,
 * `.github/workflows/*.yml`, `docs/**\/*.html` — opens a comment that never closes
 * where the author meant it to, and everything up to the next `*\/` anywhere in the
 * file is blanked. Every rule below runs on this output, so the blanked region is
 * not merely unscanned by one check: it is invisible to all of them. It happened:
 * a `release/**` in an SVG label on `release-pipeline.html` swallowed ~41 KB and
 * the page's manifest block, and the gate reported PASS on a page it had stopped
 * reading. A gate that fails open is worse than no gate, because ADR 0046 exists
 * so nobody has to read these pages by eye.
 *
 * The hazard was already known when this was written document-wide — the `/* … *\/`
 * above had to be escaped to keep this very comment from eating itself.
 *
 * A `<script type="application/json">` body is masked like any other, and the one
 * rule that needs it intact — `checkManifest`, which parses it — reads the raw
 * bytes at the offsets it located here. It is deliberately not exempted at this
 * level: every rule below runs on this output, so an exemption here widens what
 * *all* of them see, not just the parser. Two are satisfied by presence
 * (`checkTipNoteBijection`, `checkThemeTokens`) and `fontBlock` slices from the
 * last `@font-face` it can see, so a block quoting any of those inside `/* … *\/`
 * would be answering a rule with text the page only quotes. That is a fail-open in
 * the same family as the document-wide one above, bought to fix a parse.
 */
export function maskHtmlComments(source) {
  return mapEmbeddedCode(
    source.replace(/<!--[\s\S]*?-->/g, blank),
    maskCodeComments,
  );
}

/**
 * Blanks the bodies of `<script>` and `<style>` while keeping their tags, for the
 * checks that are about markup rather than about code. Without it, a script that
 * mentions `<svg>` in a string or builds markup by concatenation moves the tag
 * scanner's depth counter and every later `<title>` looks nested.
 */
function maskEmbeddedCode(source) {
  return mapEmbeddedCode(source, blank);
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
function checkManifest(code, source, findings) {
  // Attribute order is not fixed by anything, so matching `type` before `id` made a
  // perfectly good manifest report as missing. Every JSON block is parsed, not just
  // the first — a page carrying two and breaking the second would have passed.
  //
  // Blocks are located in the masked `code`, so a manifest inside an HTML comment
  // does not count as one, and the body is then read from `source` at the same
  // offsets — masking preserves length and newlines, so the two are byte-aligned.
  // That split is load-bearing: a citation anchor quotes source verbatim (ADR
  // 0085) and release-pipeline.html already quotes both `//` and `/*`. Parsing the
  // masked body reports a valid manifest as invalid when a quoted `//` blanks the
  // closing brace, and — worse, because it still parses — silently drops the keys
  // between a quoted `/*` and the next `*/`.
  let found = 0;
  for (const m of code.matchAll(
    /<script\b([^>]*\btype="application\/json"[^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const id = m[1].match(/\bid="([^"]+)"/)?.[1] ?? '(no id)';
    // Only a `…-manifest` block answers this rule. A page may carry other JSON —
    // `citation-anchors` is the first — and counting those would let a page with
    // nothing asserting it pass the check whose message names the block it wants.
    if (id.endsWith('-manifest')) found++;
    const bodyStart = m.index + m[0].indexOf('>') + 1;
    try {
      JSON.parse(source.slice(bodyStart, bodyStart + m[2].length));
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

/** Replaces every `<tag …>`, attributes included, with spaces — what is left is
 * the page's visible text in document order, whatever element carried it. */
function blankTags(code) {
  return code.replace(/<[^>]*>/g, blank);
}

// A citation's name is either a path with at least one `/` (extension optional,
// so `.github/CODEOWNERS` counts) or a single segment carrying an extension
// (`ci.yml`, `SKILL.md`). Neither shape appears in ordinary prose, which is what
// lets this scan the whole visible page instead of one tag at a time.
const NAME_RE = /(?:[\w.-]+\/)+[\w.-]+|[\w.-]+\.[A-Za-z0-9]+/;
// Either a name (optionally followed by :line, whether or not it carries one —
// a panel heading routinely just names the file it is about) or, with no name,
// a bare :line on its own.
const TOKEN_RE = new RegExp(
  `(?<name>${NAME_RE.source})(?::(?<start>\\d+)(?:-(?<end>\\d+))?)?` +
    `|:(?<bareStart>\\d+)(?:-(?<bareEnd>\\d+))?`,
  'g',
);

/**
 * Character ranges of `<span class="src">…</span>` / `<text class="src">…</text>`
 * content — the house convention for a caption that names the file a panel or
 * section is about. Scoped to this class deliberately: prose and `<code>` are
 * full of dotted, sometimes slash-bearing tokens that are not files at all —
 * `github.ref`, `release/vX.Y.Z`, `inputs.apply_only` — and treating every one
 * of them as naming a file misattributes the citation after it. A `class="src"`
 * caption is short and deliberate; nothing here has ever named the wrong file.
 */
function srcRanges(code) {
  const ranges = [];
  for (const m of code.matchAll(
    /<(span|text)\b[^>]*\bclass="src"[^>]*>([\s\S]*?)<\/\1\s*>/gi,
  )) {
    const start = m.index + m[0].indexOf('>') + 1;
    ranges.push([start, start + m[2].length]);
  }
  return ranges;
}

function within(ranges, index) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

// Extensions a bare mention (no line of its own) is allowed to name a file by.
// Bounded deliberately: `github.ref`, `inputs.apply_only`, `needs.x.result` are
// GitHub Actions expressions with the same dotted shape a filename has, and an
// unbounded check would read every one of them as naming a file too.
const KNOWN_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'json',
  'yml',
  'yaml',
  'md',
  'mdx',
  'html',
  'css',
  'toml',
  'py',
]);

function knownExtension(name) {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1];
  return ext !== undefined && KNOWN_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Every `file:line` citation on the page, in document order, regardless of which
 * element carries it — a `cite`/`src` span, a table cell, inline `<code>`, or SVG
 * label text are all just visible text once tags and embedded code are blanked
 * out (ADR 0085: "finds citations in every markup form a page uses").
 *
 * A bare `:line` or `:line-line` carries no name of its own; it resolves against
 * the filename most recently *named* on the page. A citation (`name:line`)
 * always names its file, wherever it sits. A bare *mention* — the file with no
 * line — counts in two narrower cases, because most dotted or slashed tokens in
 * prose are not files at all:
 *   - inside a `class="src"` caption (`srcRanges`): a panel heading routinely
 *     writes `<span class="src">… &middot; ci.yml</span>` once and leaves every
 *     citation under it bare, sometimes many elements later.
 *   - immediately beside the bare citation it names — nothing between them but
 *     blanked tags and punctuation, no actual word — and carrying a known file
 *     extension. `<code>ApiTokens.ts</code> (:36 access, …)` qualifies;
 *     `<code>github.ref</code> <span class="cite">:88</span>` sits just as close
 *     but `.ref` is not a file extension, and `RELEASE_NOTES.md` read from the
 *     tagged commit, so re-running it is safe (:79-100)` carries a real
 *     extension but a whole clause between it and the citation, so neither
 *     counts. A bare citation with nothing named yet ahead of it is not a
 *     citation — `16:9` in plain prose does not become one just because a regex
 *     can parse it as one — so it is silently skipped.
 */
export function findCitations(source) {
  const code = maskEmbeddedCode(maskHtmlComments(source));
  const ranges = srcRanges(code);
  const flat = blankTags(code);
  const matches = [...flat.matchAll(TOKEN_RE)];
  const citations = [];
  let lastName = null;
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const start = m.groups.start ?? m.groups.bareStart;

    if (m.groups.name && start === undefined) {
      const next = matches[i + 1];
      const adjacentBareCitation =
        next &&
        next.groups.name === undefined &&
        !/\w/.test(flat.slice(m.index + m[0].length, next.index));
      if (
        within(ranges, m.index) ||
        (adjacentBareCitation && knownExtension(m.groups.name))
      ) {
        lastName = m.groups.name;
      }
      continue;
    }
    if (m.groups.name) lastName = m.groups.name;
    if (start === undefined) continue;

    const name = m.groups.name ?? lastName;
    if (!name) continue;
    const end = m.groups.end ?? m.groups.bareEnd;
    citations.push({
      name,
      line: Number(start),
      endLine: end ? Number(end) : Number(start),
      sourceLine: lineOf(flat, m.index),
      raw: m[0],
    });
  }
  return citations;
}

/**
 * A factual-assertion rule (ADR 0085): it runs over `LEGACY` pages as well as
 * `ROSTER` ones, because none of the five `LEGACY` reasons are about being wrong.
 *
 * Resolving a citation here is necessary and not sufficient — it proves the claim
 * is *possible*, not that it is *true*. `resolveCitation` is asked only whether
 * some file named `name` exists with enough lines; it is not asked whether that
 * file is the right one, which needs the citation to carry the content it names
 * (#788's anchoring). A bare name with several same-named candidates in the tree
 * (`package.json`, `SKILL.md`) resolves if any one of them is long enough — this
 * step can tell an impossible citation from a possible one, not a right file from
 * a coincidentally long wrong one.
 */
function checkCitations(source, findings, resolveCitation) {
  for (const citation of findCitations(source)) {
    const result = resolveCitation(citation);
    if (!result.ok) {
      findings.push({
        rule: 'citation-unresolved',
        line: citation.sourceLine,
        message: result.reason,
      });
    }
  }
}

/**
 * Which rules honour the `LEGACY` exemption and which do not (ADR 0085). A
 * mechanical-hygiene rule is about how the page is built — font blocks, storage
 * guards, self-containment — and a `LEGACY` reason is always one of those, so
 * `LEGACY` pages skip these. A factual-assertion rule is about whether the page
 * still describes the tree, and no styling exemption is a reason to stop checking
 * that: these run over `ROSTER` and `LEGACY` pages alike.
 */
export const RULE_KINDS = {
  'svg-title-tooltip': 'mechanical-hygiene',
  'tip-note-bijection': 'mechanical-hygiene',
  'external-resource': 'mechanical-hygiene',
  'theme-tokens-incomplete': 'mechanical-hygiene',
  'unguarded-storage': 'mechanical-hygiene',
  'manifest-missing': 'mechanical-hygiene',
  'manifest-invalid': 'mechanical-hygiene',
  'prettier-ignore-missing': 'mechanical-hygiene',
  'adr-link-broken': 'mechanical-hygiene',
  'font-block-drift': 'mechanical-hygiene',
  'citation-unresolved': 'factual-assertion',
};

/**
 * Runs only the factual-assertion rules — today, citation resolution — over a
 * page the `LEGACY` exemption otherwise skips entirely (ADR 0085).
 *
 * @param {object} input
 * @param {string} input.source raw page text
 * @param {(citation: {name: string, line: number, endLine: number}) => {ok: boolean, reason?: string}} input.resolveCitation
 * @returns {Array<{rule: string, line: number, message: string}>}
 */
export function scanFactualAssertions({ source, resolveCitation }) {
  const findings = [];
  checkCitations(source, findings, resolveCitation);
  return findings.sort((a, b) => a.line - b.line);
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
 * @param {(citation: {name: string, line: number, endLine: number}) => {ok: boolean, reason?: string}} input.resolveCitation
 * @returns {Array<{rule: string, line: number, message: string}>} findings, in file order
 */
export function scanDesignPage({
  file,
  source,
  canonicalFontHash,
  pageFontHash,
  prettierIgnored,
  adrLinkExists,
  resolveCitation,
}) {
  const code = maskHtmlComments(source);
  const findings = [];

  checkSvgTitles(maskEmbeddedCode(code), findings);
  checkTipNoteBijection(code, findings);
  checkExternalResources(code, findings);
  checkThemeTokens(code, findings);
  checkStorageGuards(code, findings);
  checkManifest(code, source, findings);
  checkPrettierIgnored(file, prettierIgnored, findings);
  checkAdrLinks(file, code, adrLinkExists, findings);
  checkCitations(source, findings, resolveCitation);

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
