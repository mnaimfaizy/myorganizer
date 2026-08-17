@AGENTS.md

# Claude Code

This file is a Harness Adapter. Shared always-on policy lives in `AGENTS.md`. Do not restate it here.

## Checklist

Classify `gate:*` with [`.claude/checklist.md`](.claude/checklist.md) Step 0 before editing.

## Skills

Repo Skills live in `.agents/skills/` and are exposed to Claude Code via the `.claude/skills` symlink. Load the Skill for a named workflow. Do not copy its procedure into this file.

## Sub-agents

Generated copies live in `.claude/agents/`. Canonical bodies are `.github/agents/*.agent.md`. After any Sub-agent change: `yarn agents:sync` then `yarn agents:sync:check`. Keep Cursor `CodeExplorer` on `model: composer-2.5` (enforced by sync).

## Dependency Sync hook

A Claude Code hook fires after `yarn add` / `yarn remove` / `yarn up` / `npm install`. Still run the `dep-sync` Skill and confirm before DepSync writes.
