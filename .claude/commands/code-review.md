# Code Review Command

Use this workflow when the user wants to review changes since a fixed point (commit, branch, tag, or merge-base).

1. Read and follow `.github/skills/code-review/SKILL.md` exactly.
2. Pin the fixed point; confirm `git rev-parse` resolves and the three-dot diff is non-empty.
3. Identify the spec source (issue refs in commits → `gh issue view` per `docs/agents/issue-tracker.md`, user path, or PRD file).
4. Gather standards sources (`AGENTS.md`, `CLAUDE.md`, `docs/ui/GUIDELINES.md`, `docs/testing/README.md`, `CONTEXT.md`, ADRs, vault rules) plus the smell baseline.
5. Spawn Standards and Spec sub-agents in parallel via `Task` (`generalPurpose`).
6. Aggregate findings under `## Standards` and `## Spec` — do not merge or rerank across axes.
