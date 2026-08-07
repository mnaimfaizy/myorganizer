# Pin sub-agent models by role and require reviewed migrations

Sub-agent model choice is a cost and quality control, not an incidental harness preference. We keep one versioned role-to-model policy for GitHub Copilot, Claude Code, Cursor, and Gemini CLI and synchronize every agent frontmatter from it. The orchestrator does not change pinned models automatically: repeated failures escalate to the main agent or a human. The monthly audit compares assignments with first-party catalog and pricing sources and opens an issue for human review when a model disappears, a source changes, or configuration drifts.

## Status

accepted

## Considered Options

- **Let the orchestrator choose any model** — rejected because it makes spend unpredictable, weakens the cheap-exploration guarantee, and tends to overuse the parent model.
- **Pin every role permanently** — rejected because model catalogs change; monthly review allows deliberate migrations without runtime model roulette.
- **Automatically migrate models and open a PR** — rejected because catalog presence does not prove task fitness, account availability, or acceptable output quality. Automated detection creates an issue; a human approves policy changes.

## Consequences

- `tools/config/agent-model-policy.json` is the model-assignment source of truth; `.github/agents`, `.claude/agents`, `.cursor/agents`, and `.gemini/agents` remain the executable adapters.
- `gate:*` still controls workflow depth and `complexity:*` still controls task difficulty. Model tier is a role default, not a replacement for either label.
- Catalog snapshots are change detectors, not benchmarks. A changed source requires review and a focused quality/cost comparison before migration.
- Sandcastle records token telemetry when providers expose it. Dollar cost remains plan-dependent and must not be inferred from API list prices when a run uses subscription or included usage.
