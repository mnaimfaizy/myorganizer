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
- Canonical model assignment: `tools/config/agent-model-policy.json`
- Body sync: `tools/scripts/sync-subagents.mjs`
- Model sync: `tools/scripts/sync-agent-models.mjs`

Do not manually copy agent bodies across harnesses unless the script is unavailable.

## Model Assignment Policy

Model assignments come from `tools/config/agent-model-policy.json`. Agent bodies remain canonical in `.github/agents`; model frontmatter is canonical in the policy.

- GitHub Copilot (`.github/agents`): can define model priority lists.
- Claude (`.claude/agents`): uses one alias or model ID.
- Cursor (`.cursor/agents`): uses one model ID. `CodeExplorer` must use `composer-2.5`.
- Gemini (`.gemini/agents`): uses one model ID.

Assignment strategy:

1. Prefer low-cost fast models for exploration, triage, and repetitive workflows.
2. Use stronger models for generation, synthesis, planning, and judgment only when the role tier requires it.
3. Escalate repeated failures to the main agent or human; do not change pinned models automatically.
4. Run `yarn agents:models:audit` before accepting catalog or assignment changes.

## Required Triggers

Run this workflow after any of the following:

- Edit to any file in `.github/agents/**`
- Edit to any file in `.claude/agents/**`, `.cursor/agents/**`, or `.gemini/agents/**`
- Agent add/remove in any harness
- Model change in any agent frontmatter

## Validation Checklist

Before closing the task:

- `yarn agents:sync:check` returns exit code 0.
- `CodeExplorer` in Cursor remains `model: composer-2.5`.
- Every harness model matches `tools/config/agent-model-policy.json`.
- No canonical agent exists only in `.github/agents`.
- No stale removed canonical agents remain in target harness directories (unless explicitly using `--no-prune`).
