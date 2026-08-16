# Upstream Brief: next

- **Date:** 2026-08-16
- **HITL issue:** #359
- **Subjects:**
  - `next` current `16.2.6` → target `16`
- **Sources:** primary upstream pages only (linked on each finding)

Official docs fetched for this run are labelled **16.3.1** on nextjs.org. The named target is major **16**; this repo pins **16.2.6**. Where a page describes a 16.3-only behaviour, that is called out.

## Findings

### next

#### Future-risk

- **Claim:** Official Next.js 16 docs deprecate `middleware.ts` / `export function middleware` in favour of `proxy.ts` / `export function proxy` (Node.js runtime only). `middleware` remains only as a deprecated Edge escape hatch and is slated for removal.
- **Source:** [Proxy file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — docs 16.3.1; [Next.js 16 blog](https://nextjs.org/blog/next-16) — release 16; [Upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) — docs 16.3.1
- **Local evidence:** No `middleware.ts` or `proxy.ts` under `apps/myorganizer`. Repo-owned instructions never name `proxy.ts`. Agents will keep inventing `middleware.ts` from the training corpus.
- **Disposition:** plan

Official pages disagree on how equivalent the rename is — both recorded, no winner:

- [Getting Started: Proxy](https://nextjs.org/docs/app/getting-started/proxy) (16.3.1): “The functionality remains the same.”
- [Upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (16.3.1): Edge is not supported in `proxy`; keep using `middleware` for Edge.
- [Next.js 16 blog](https://nextjs.org/blog/next-16): `middleware.ts` still available for Edge, deprecated.

- **Claim:** Synchronous `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are removed in Next.js 16; only `await` forms are valid.
- **Source:** [Upgrade to version 16 — Async Request APIs](https://nextjs.org/docs/app/guides/upgrading/version-16) — docs 16.3.1; [headers() API](https://nextjs.org/docs/app/api-reference/functions/headers) — docs 16.3.1; [v16.0.0 release](https://github.com/vercel/next.js/releases/tag/v16.0.0)
- **Local evidence:** none in scanned instruction files. Sampled `apps/myorganizer` / `libs/web-ui` / `libs/web/pages` did not show a Next.js `middleware.ts` or an obvious sync `headers()` teaching line. Risk is agent-invented sync access.
- **Disposition:** plan

- **Claim:** `next lint` is removed; `next build` no longer lints; `eslint` in `next.config` is gone.
- **Source:** [Upgrade to version 16 — Removals](https://nextjs.org/docs/app/guides/upgrading/version-16) — docs 16.3.1
- **Local evidence:** none in scanned instruction files (this repo already uses Nx/ESLint). Still worth a positive “do not suggest `next lint`” line so agents do not reintroduce it.
- **Disposition:** plan

#### Mismatch

- **Claim:** The Research specialist still tells workers to tie findings to “Next.js 14 App Router,” which contradicts `TECH_STACK.md` (`next` 16.2.6) and ADR 0001 (no inline version claims).
- **Source:** [Installation](https://nextjs.org/docs/app/getting-started/installation) — docs 16.3.1 (App Router is the official default); version truth is `TECH_STACK.md` row `next` 16.2.6
- **Local evidence:** `.github/agents/research.agent.md` line 24; `.claude/agents/research.md` line 23; `.gemini/agents/research.md` line 29
- **Disposition:** plan

#### Missed improvement

- **Claim:** At Next.js 16.2+, official guidance is to point coding agents at bundled docs in `node_modules/next/dist/docs/` before they write Next.js code. Auto-upsert of that `AGENTS.md` block starts at 16.3+; at 16.2 it is manual.
- **Source:** [AI Coding Agents guide](https://nextjs.org/docs/app/guides/ai-agents) — docs 16.3.1; [Upgrade to version 16 — Set up AI agent docs](https://nextjs.org/docs/app/guides/upgrading/version-16) — docs 16.3.1
- **Local evidence:** `AGENTS.md` has no pointer to `node_modules/next/dist/docs/`.
- **Disposition:** plan

- **Claim:** Official docs prefer `next.config` `redirects` / `rewrites` over Proxy for simple cases, and treat Proxy as a last resort.
- **Source:** [Getting Started: Proxy](https://nextjs.org/docs/app/getting-started/proxy) — docs 16.3.1
- **Local evidence:** none in scanned files (no Next.js proxy/middleware file). Useful as instruction so agents do not add a proxy “for completeness.”
- **Disposition:** plan

## Proposed plan

Repo-owned instructions and hygiene/test scripts only. No package bumps. No application-code edits.

- **Research agent (canonical + harness copies):** stop naming “Next.js 14.” Point at `TECH_STACK.md` for the Next.js version, same as other instruction files.
- **Frontend / Next.js instruction kind (`AGENTS.md`, `DEVELOPMENT.md`, `.github/copilot-instructions.md`):** add a short positive block: new Next.js request interception is `proxy.ts` (Node-only); do not teach `middleware.ts` unless the case is deprecated Edge; always `await` `headers` / `cookies` / `params` / `searchParams`; do not suggest `next lint`; prefer `next.config` redirects/rewrites over Proxy.
- **`AGENTS.md`:** add a pointer to `node_modules/next/dist/docs/` as the version-matched Next.js doc set for this pin (16.2.6). Do not claim 16.3 auto-generation until the pin moves.

When writing the proxy line, state both official positions: Getting Started says functionality is the same; the v16 upgrade guide says Edge is not supported in `proxy`.

## Follow-on

_None._ No `middleware.ts` / `proxy.ts` in sampled application source. Express `apps/backend/src/middleware/` is not a Next.js finding. Installed vendor Next.js skills were not treated as sources or edit targets.

## Failed hops

_None._
