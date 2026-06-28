# Sandcastle Prompt Template

> **Note:** This file is NOT used by the `dispatch-agents` orchestrator.
> The orchestrator (`main.mts`) builds per-slice prompts dynamically from
> each GitHub Slice Issue's body. This file is kept for reference only — it
> shows the structure each dynamically-built prompt follows.

---

# Context

You are implementing a vertical slice for MyOrganizer.

- Dependencies are **already installed** in this sandbox before you start (a setup hook runs `corepack yarn install --immutable`). Do NOT run `yarn install` yourself.
- Read `CLAUDE.md`, `CONTEXT.md`, and `TECH_STACK.md` before making any changes.
- Follow all mandatory delegation rules in `CLAUDE.md` (tests → TestScaffold, components → ComponentBuilder, etc.).
- Work only on the branch you were given. Do not switch branches.
- Commit with Conventional Commit messages (`corepack yarn ai:commit`).
- Do NOT push and do NOT open a PR — the sandbox has no credentials. Just commit locally; the orchestrator integrates your branch into the feature branch on the host.

# Task

<!-- Populated dynamically by main.mts from the Slice Issue body -->

# Done

When implementation is complete, output `<promise>COMPLETE</promise>` to signal early termination.
