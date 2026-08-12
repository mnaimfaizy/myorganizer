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
- Ensure Cursor `CodeExplorer` remains `model: composer-2.5`.
- Never hand-edit an instruction into `.gemini/agents/**`; the next apply regenerates the body from
  canonical and the edit is lost. Put it in canonical instead.

## Harness-specific body sections

Canonical bodies may scope a section to particular harnesses:

```markdown
<!-- harness:gemini -->

Rendered only into .gemini/agents/.

<!-- /harness -->
```

- Valid names: `claude`, `copilot`, `cursor`, `gemini`. Unmarked content goes to every harness.
- Markers sit alone on their own line and must not nest; violations are hard errors.
- Main use is MCP tool naming. In Gemini CLI the fully qualified name is `mcp_<server>_<tool>`, and
  `mcp_<server>_*` grants a whole server; servers are registered in `.gemini/settings.json`.
- Implementation: `tools/scripts/lib/harness-sections.mjs`; test with `yarn agents:sync:test`.

## Model policy

- Use low-cost defaults for high-volume delegations.
- Escalate repeated failures to the main agent or human; do not change pinned models automatically.
- Maintain assignments in `tools/config/agent-model-policy.json`.

## Reference

- `.github/skills/sub-agent-sync-workflow/SKILL.md`
- `tools/scripts/sync-subagents.mjs`
- `tools/scripts/sync-agent-models.mjs`
