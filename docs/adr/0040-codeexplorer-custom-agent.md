# We use a custom CodeExplorer agent over inline exploration

Claude Code ships a built-in `Explore` agent, but we created a custom `CodeExplorer` for two reasons: cross-IDE portability (Cursor, Gemini CLI, and GitHub Copilot have no built-in Explore equivalent) and domain awareness (`CodeExplorer` reads `DEVELOPMENT.md` on every run, so it navigates the Nx monorepo structure without requiring step-by-step hints from the main agent). The cost saving — Haiku/Flash instead of frontier models — is consistent across all IDEs because each adapter declares the cheapest available model in its own frontmatter.

## Considered Options

- **Built-in Claude Code `Explore` agent** — zero setup, fast, but Claude-only and carries no MyOrganizer context. Other IDEs would still explore inline with the frontier model.
- **Custom `CodeExplorer` with per-IDE adapters** — requires maintaining four adapter files (`.github/agents/`, `.claude/agents/`, `.gemini/agents/`, `.cursor/agents/`), but delivers cross-IDE consistency, domain-aware exploration via `DEVELOPMENT.md`, and enforced cheap-model usage on every run.

## Consequences

When a new library or app is added to the monorepo, `DEVELOPMENT.md` must be updated — that is the single change required for `CodeExplorer` to navigate the new structure correctly across all IDEs.

## Amended 2026-10-02 (issues #988, #990)

Two statements above no longer hold. Both were measured, not assumed; the runs are recorded on the two issues.

- **Orientation moved off `DEVELOPMENT.md`.** `CodeExplorer` read only the first 60–150 lines of that 1,406-line file, never reaching its structure tree at line 357 — and the tree had gone stale without anything noticing (no `escape-copy-reader`, `libs/mobile`, `vault-core`, `design-tokens` or `email-shell`). It now orients from the `## Repository layout` section of `README.md`, which `yarn readme:check` asserts against the tree in both directions, plus the `AGENTS.md` nearest the code in question. The consequence above therefore changes: a new app or library is recorded in the README, which is already the rule in `AGENTS.md`.
- **Claude Code runs it on Sonnet, not Haiku.** On Haiku it cited line ranges that do not exist under a `[found]` tag and, on a fan-out question, found 8–10 of 17 expected places against 13–15 on Sonnet, while telling the caller that the places it had missed needed no change. Rewriting the agent's instructions did not close that gap. Per run Haiku cost about a third as much and was no faster. The cheapest-model rule still stands for Copilot, Cursor and Gemini, whose assignments were not tested; the role's tier in `tools/config/agent-model-policy.json` stays `T0`, which describes the role across harnesses, not one harness's model.
