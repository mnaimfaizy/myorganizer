# GitHub Copilot Instructions for MyOrganizer

Follow the repo Instruction File: [AGENTS.md](../AGENTS.md). Nested `apps/*/AGENTS.md` and `libs/*/AGENTS.md` apply to the nearest path.

GitHub Copilot also loads this file as repository-wide instructions, separate from `AGENTS.md`. Keep it a Harness Adapter — do not duplicate policy here.

## Copilot-only

- Custom agents: `.github/agents/*.agent.md`
- Skills: `.agents/skills/`
- After any Sub-agent change: `yarn agents:sync` then `yarn agents:sync:check`
