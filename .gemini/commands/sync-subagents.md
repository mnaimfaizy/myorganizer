# sync-subagents

Synchronize sub-agent files across all harnesses using `.github/agents` as canonical source.

## When to run

- A file under `.github/agents/` changed.
- A file under `.claude/agents/`, `.cursor/agents/`, or `.gemini/agents/` changed.
- A sub-agent was added or removed in any harness.
- A sub-agent model was changed.

## Commands

1. Check drift:

```bash
yarn agents:sync:check
```

2. Apply sync and prune non-canonical extras:

```bash
yarn agents:sync
```

3. Apply sync without pruning extras (rare):

```bash
node tools/scripts/sync-subagents.mjs --apply --no-prune
```

## Rules

- Keep `.github/agents/*.agent.md` body content as canonical.
- Preserve existing harness-specific frontmatter when file already exists.
- Create missing files in `.claude/agents`, `.cursor/agents`, and `.gemini/agents`.
- Remove target files with no canonical counterpart when pruning is enabled.
- Ensure Cursor `CodeExplorer` remains `model: composer`.

## Model policy

- Use low-cost defaults for high-volume delegations.
- Upgrade only for quality-sensitive agents (research/synthesis heavy).
- Maintain model defaults in `tools/scripts/sync-subagents.mjs`.

## Reference

- `.github/skills/sub-agent-sync-workflow/SKILL.md`
- `tools/scripts/sync-subagents.mjs`
