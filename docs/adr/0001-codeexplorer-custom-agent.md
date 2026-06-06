# We use a custom CodeExplorer agent over inline exploration

Claude Code ships a built-in `Explore` agent, but we created a custom `CodeExplorer` for two reasons: cross-IDE portability (Cursor, Gemini CLI, and GitHub Copilot have no built-in Explore equivalent) and domain awareness (`CodeExplorer` reads `DEVELOPMENT.md` on every run, so it navigates the Nx monorepo structure without requiring step-by-step hints from the main agent). The cost saving — Haiku/Flash instead of frontier models — is consistent across all IDEs because each adapter declares the cheapest available model in its own frontmatter.

## Considered Options

- **Built-in Claude Code `Explore` agent** — zero setup, fast, but Claude-only and carries no MyOrganizer context. Other IDEs would still explore inline with the frontier model.
- **Custom `CodeExplorer` with per-IDE adapters** — requires maintaining four adapter files (`.github/agents/`, `.claude/agents/`, `.gemini/agents/`, `.cursor/agents/`), but delivers cross-IDE consistency, domain-aware exploration via `DEVELOPMENT.md`, and enforced cheap-model usage on every run.

## Consequences

When a new library or app is added to the monorepo, `DEVELOPMENT.md` must be updated — that is the single change required for `CodeExplorer` to navigate the new structure correctly across all IDEs.
