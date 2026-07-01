---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

**Before doing anything else, read `.github/skills/codebase-design/SKILL.md`** — it defines the vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and principles (deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real") that every suggestion in this skill must use exactly. Refer to its companion files as needed:

- **[DEEPENING.md](../codebase-design/DEEPENING.md)** — dependency categories (in-process, local-substitutable, ports & adapters, mock), seam discipline, and the replace-don't-layer testing strategy. Use this when classifying each candidate's dependencies.
- **[DESIGN-IT-TWICE.md](../codebase-design/DESIGN-IT-TWICE.md)** — parallel sub-agent pattern for exploring radically different interfaces. Use this in the grilling loop when the user wants to explore alternative interface shapes.

Do NOT drift into "component," "service," "API," or "boundary." Do NOT define these terms yourself — they come from `codebase-design/SKILL.md`.

This skill is also _informed_ by the project's domain model:

- The domain language in `CONTEXT.md` gives names to good seams.
- ADRs in `docs/adr/` record decisions this skill should not re-litigate — only surface a candidate that contradicts an ADR when the friction is real enough to warrant revisiting it.

When the grilling loop produces **new domain terms or ADRs**, delegate those updates to the **[domain-modeling skill](./../domain-modeling/SKILL.md)** — it owns the format, discipline, and inline-update workflow for `CONTEXT.md` and `docs/adr/`.

## Process

### 1. Explore

Read the project's domain glossary (`CONTEXT.md`) and any ADRs in `docs/adr/` that touch the area you're examining.

Then delegate to the `CodeExplorer` sub-agent to walk the codebase. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it for the user — `xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows — and tell them the absolute path.

The report uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals. Each candidate gets a **before/after visualisation**.

For each candidate, render a card with:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram** — side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength** — one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use `CONTEXT.md` vocabulary for the domain.** If `CONTEXT.md` defines "Vault," talk about "the Vault sync module" — not "the EncryptionHandler."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly in the card (e.g. a warning callout: _"contradicts ADR-0007 — but worth reopening because…"_).

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet. After the file is written, ask the user: **"Which of these would you like to explore?"**

### 3. Grilling loop

Once the user picks a candidate, run the `/grill-with-docs` skill to walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallise:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Invoke the **[domain-modeling skill](./../domain-modeling/SKILL.md)** to add the term. It owns the format (`CONTEXT-FORMAT.md`) and the inline-update discipline — capture the term immediately, don't batch.
- **Sharpening a fuzzy term during the conversation?** Same: use the domain-modeling skill to update `CONTEXT.md` right there.
- **User rejects the candidate with a load-bearing reason?** Use the domain-modeling skill to offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ The domain-modeling skill owns `ADR-FORMAT.md` — only offer when all three conditions are met (hard to reverse, surprising without context, result of a real trade-off).
- **Want to explore alternative interfaces for the deepened module?** Use the design-it-twice parallel sub-agent pattern in `.github/skills/codebase-design/DESIGN-IT-TWICE.md`.

## MyOrganizer-specific context

When exploring this codebase, be aware of the following architectural landmarks:

| Area                            | What to look for                                                    |
| ------------------------------- | ------------------------------------------------------------------- |
| `apps/backend/src/controllers/` | Thin controllers that may be doing service-level work               |
| `apps/backend/src/services/`    | Services that cross domain boundaries (e.g. auth + vault)           |
| `libs/vault-core/`              | Vault crypto primitives — seams between encryption and sync         |
| `libs/web-vault/`               | Client-side vault state — seams between sync, storage, and UI       |
| `libs/web/pages/*/`             | Feature page modules — shallow orchestrators vs. deep feature logic |
| `libs/web-ui/`                  | UI primitives — check for logic leaking into presentational modules |
| `libs/auth/`                    | Auth utilities — shared between backend and frontend                |

The Nx module boundary rules (enforced by ESLint) define the allowed seams. A candidate that proposes crossing a module boundary must also propose updating the boundary rules.
