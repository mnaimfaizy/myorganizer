/**
 * Which pages under `docs/` are House Explainer Pages, and which are deliberately
 * not gated. Scope is an explicit roster, not a glob (ADR 0046): `docs/**` holds
 * three lineages of HTML page and only one is this convention.
 *
 * This lives in its own module so the roster has exactly one definition. It was a
 * `const` inside `check-design-hygiene.mjs`, which the CLI cannot export without
 * running its whole main body on import, so the contract suite kept a hand-copied
 * mirror. The mirror rotted the first time the roster grew: the fixture workspace
 * writes one page per entry, so a page added to the checker and not to the copy
 * failed two tests with `page-missing` — a failure about bookkeeping wearing the
 * costume of a failure about the page.
 */

/** Pages authored to the house convention. Adding one here is how it gets gated. */
export const ROSTER = [
  'docs/agents/orchestration-map.html',
  'docs/deployment/release-pipeline.html',
  'docs/sandcastle/dispatch-map.html',
  'docs/sandcastle/gates.html',
  'docs/sandcastle/logs.html',
  'docs/sandcastle/resume.html',
  'docs/sandcastle/waves.html',
];

/**
 * Pages under docs/ that are deliberately not gated, each with the reason. An
 * entry here is a decision someone made rather than a gap nobody saw; retrofitting
 * one is its own change, not a prerequisite for gating the pages that already comply.
 */
export const LEGACY = {
  'docs/agents/agent-journey.html':
    'Claude Design canvas export. Its bundled dc-runtime carries CDN fallback URLs as strings, which the self-containment rule cannot distinguish from a real load.',
  'docs/agents/skill-atlas.html':
    'Carries no @font-face block; its typography falls back to system stacks. Predates the canonical block.',
  'docs/authentication/session-lifecycle.html':
    'Carries its own @font-face block rather than the canonical one, defines dark tokens under an unguarded @media, and is absent from .prettierignore.',
  'docs/vault/lifecycle.html':
    'Canvas export, and the source of the canonical @font-face block. Defines dark tokens only under [data-theme=dark], with no prefers-color-scheme state.',
  'docs/vault/trust-boundary.html':
    'Same theme shape as lifecycle.html — predates the three-state convention.',
};

/**
 * The page every sibling splices its @font-face block from. Named here rather than
 * pinned as a literal hash so the comparison stays a fact about two files, and so
 * the slicing convention has exactly one implementation (design-page-scan.mjs).
 */
export const CANONICAL_FONT_PAGE = 'docs/vault/lifecycle.html';
