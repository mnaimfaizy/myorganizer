# Sub-Agent Synchronization Workflow

Use this workflow whenever any sub-agent file changes in any harness directory.

## Goal

Keep these directories structurally synchronized with `.github/agents` as the canonical source of truth:

- `.github/agents` (canonical)
- `.claude/agents`
- `.cursor/agents`
- `.gemini/agents`

Synchronization means:

1. Every canonical agent exists in each target harness.
2. Agent body content in each target harness matches canonical body content.
3. Added or removed canonical agents are propagated to all target harnesses.
4. Harness-specific frontmatter is preserved when file already exists.
5. Missing files are created with harness defaults.

## Commands

- Check drift only:
  - `yarn agents:sync:check`
- Apply sync and prune extras:
  - `yarn agents:sync`
- Keep extra non-canonical files (rare):
  - `node tools/scripts/sync-subagents.mjs --apply --no-prune`

## Source of Truth

- Canonical file body: `.github/agents/<agent>.agent.md`
- Automation script: `tools/scripts/sync-subagents.mjs`

Do not manually copy agent bodies across harnesses unless the script is unavailable.

## Model Assignment Policy

When creating missing harness files, model selection must respect harness availability and cost goals.

- GitHub Copilot (`.github/agents`): can define model priority lists.
- Claude (`.claude/agents`): use a single low-cost default (`haiku`) unless quality needs are explicit.
- Cursor (`.cursor/agents`): use a single model. `CodeExplorer` must use `composer`.
- Gemini (`.gemini/agents`): use a single low-cost default (`gemini-2.5-flash`) unless quality needs are explicit.

Backup strategy:

1. Prefer low-cost fast models for exploration, triage, and repetitive workflows.
2. Use stronger models only for research-heavy or synthesis-heavy agents.
3. Keep model defaults centralized in `tools/scripts/sync-subagents.mjs` (`defaultModelByAgent` + `defaultModel`).

## Required Triggers

Run this workflow after any of the following:

- Edit to any file in `.github/agents/**`
- Edit to any file in `.claude/agents/**`, `.cursor/agents/**`, or `.gemini/agents/**`
- Agent add/remove in any harness
- Model change in any agent frontmatter

## Validation Checklist

Before closing the task:

- `yarn agents:sync:check` returns exit code 0.
- `CodeExplorer` in Cursor remains `model: composer`.
- No canonical agent exists only in `.github/agents`.
- No stale removed canonical agents remain in target harness directories (unless explicitly using `--no-prune`).
