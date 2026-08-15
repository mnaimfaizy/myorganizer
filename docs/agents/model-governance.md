# Agent model governance

MyOrganizer pins sub-agent models by **role** across GitHub Copilot, Claude Code, Cursor, and Gemini CLI. Assignments live in one versioned policy file; harness agent files are synchronized adapters. A monthly audit detects drift and catalog changes but never rewrites pins automatically.

See [ADR 0013: Role-pinned sub-agent model governance](../adr/0013-bounded-subagent-model-governance.md) for the decision record.

Two static pages illustrate this, both self-contained — open either in a browser, no build step
and no network:

- [orchestration-map.html](orchestration-map.html) — **who** the agents are and how they chain:
  pipelines, retry caps, human gates, and the tier assignments below.
- [agent-journey.html](agent-journey.html) — **what happens over time** to one work item, as a
  play/step walkthrough of three scenarios (AFK slice, interactive bug fix, `gate:full` with
  E2E). Playback halts at every human gate until you approve it, which is the point.

`yarn agents:map:check` fails if the roster or tiers on either page fall behind the policy file,
so treat a failure there as "the diagram is stale", not "the check is broken".

## Operating model

Three independent controls govern agent work:

| Control               | What it decides                                      | Examples                                                                                          |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `gate:*`              | Pipeline depth — how many specialist hops run        | `gate:mechanical`, `gate:standard`, `gate:full` ([ADR 0012](../adr/0012-tiered-quality-gates.md)) |
| `complexity:*`        | Task difficulty — Sandcastle orchestrator model size | `complexity:low`, `complexity:medium`, `complexity:high`                                          |
| Role tier (`T0`–`T2`) | Default sub-agent model economics per harness        | Defined in policy; synced to agent frontmatter                                                    |

Each sub-agent has a fixed model assignment per harness. The orchestrator does not silently change it. Repeated specialist failures escalate to the main agent or a human, who can approve a policy change or explicit run override. Model tier does not replace `gate:*` or `complexity:*`.

### Role tiers

| Tier   | Work profile                            | Optimization goal                  |
| ------ | --------------------------------------- | ---------------------------------- |
| **T0** | Deterministic, repetitive, or read-only | Low cost and latency               |
| **T1** | Code generation or bounded synthesis    | Reliable tool use and code quality |
| **T2** | Planning and judgment gates             | Reasoning quality; use sparingly   |

### Source of truth

[`tools/config/agent-model-policy.json`](../../tools/config/agent-model-policy.json) holds:

- Per-agent `tier` and per-harness `models` (Copilot may use prioritized arrays)
- Sandcastle defaults and Claude complexity routing
- `catalogSources` — official doc URLs, required terms, and snapshot baselines
- `costSources` — official billing/pricing URLs per harness

Executable adapters:

- `.github/agents/*.agent.md` (canonical bodies)
- `.claude/agents/*.md`, `.cursor/agents/*.md`, `.gemini/agents/*.md` (synced bodies and model frontmatter)

## Commands

| Command                    | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `yarn agents:sync`         | Sync agent bodies, then model frontmatter from policy |
| `yarn agents:sync:check`   | Validate body and model frontmatter                   |
| `yarn agents:map:check`    | Assert the orchestration map still matches the policy |
| `yarn agents:models:audit` | Check assignments and first-party catalog snapshots   |
| `yarn agents:usage:report` | Summarize Sandcastle token telemetry                  |

### Audit options

```bash
yarn agents:models:audit --offline
yarn agents:models:audit --report ./agent-model-audit.md
yarn agents:models:audit --print-snapshots
```

The online audit checks frontmatter drift, verifies assigned model terms still appear in first-party sources, and compares filtered catalog and pricing snapshots. It exits `1` for governance findings and `2` when source availability prevents a complete audit. It never modifies policy or agent files.

### Usage report options

```bash
yarn agents:usage:report
yarn agents:usage:report -- --prd 42
yarn agents:usage:report -- --since 2026-07-01
yarn agents:usage:report -- --json
```

The reporter merges `.sandcastle/usage/agent-usage.jsonl` with older token lines in `.sandcastle/logs/*.log`, removing aggregate duplicates. Output groups runs, iterations, and tokens by PRD workflow and by harness/model; missing provider telemetry is counted explicitly.

## Monthly flow

The [monthly audit workflow](../../.github/workflows/monthly-agent-model-audit.yml) runs on the first day of each month and supports manual dispatch.

1. Validate all four harness assignments against policy.
2. Fetch first-party catalog sources.
3. Check required model terms plus catalog and pricing snapshots.
4. Publish the report in the workflow summary.
5. On findings, create or update `[automation] Agent model governance drift`.

The workflow does not open a PR or rewrite model pins. Catalog presence does not prove task fitness, account availability, or acceptable output quality.

## Interpreting audit results

| Finding                  | Meaning                                             | Action                                                                |
| ------------------------ | --------------------------------------------------- | --------------------------------------------------------------------- |
| Assignment sync fails    | Harness frontmatter differs from policy             | Run `yarn agents:sync` or correct the policy                          |
| Assigned model not found | Possible removal, rename, or documentation change   | Verify the first-party catalog before changing pins                   |
| Catalog snapshot changed | Possible launch, removal, or status change          | Compare quality and cost before migration                             |
| Pricing snapshot changed | Rates, credits, included pools, or overages changed | Review the first-party billing page and update expectations           |
| No baseline              | Policy source is incomplete                         | Capture and review a new snapshot                                     |
| Source warning           | Network failure or source structure changed         | Workflow fails without filing a drift issue; retry and verify the URL |

Catalog snapshots are change detectors, not benchmarks.

## Safe update procedure

1. Confirm the candidate model fits the agent role and tier.
2. Update `tools/config/agent-model-policy.json` and its `reviewedAt` date.
3. Refresh the relevant snapshot only after reviewing the official source.
4. Run `yarn agents:sync`.
5. Run `yarn agents:sync:check`.
6. Run the online `yarn agents:models:audit`.
7. Compare focused output quality and token usage before accepting the migration.

Do not edit model frontmatter in one harness without updating policy first.

## Cost and loop analysis

Token totals are the portable measurement. Actual dollar cost depends on:

- Subscription tier and included usage pools
- Cache read/write rates
- Request or credit multipliers
- Overage settings and provider routing fallbacks

Official billing references live under `costSources` in the policy. Do not equate API list prices with invoices for subscription-backed or included-usage runs.

Use usage reports to investigate:

- High T2 run counts
- Repeated specialist cycles on one slice
- Unexpected output-token growth after a model migration
- Cache-read/input shifts
- Runs where telemetry is unavailable

## Limitations

- Public documentation pages are not stable machine-readable APIs; layout changes can trigger false snapshot drift.
- Harness identifiers differ: Copilot display names, Claude aliases, Cursor slugs, and Gemini model IDs.
- Not every provider exposes per-sub-agent telemetry.
- Legacy log records may not contain timestamps or PRD linkage.
- Sandcastle orchestrator routing and sub-agent role assignments are related policies but use different model identifiers.

## References

- [ADR 0013: Role-pinned sub-agent model governance](../adr/0013-bounded-subagent-model-governance.md)
- [ADR 0012: Tiered quality gates](../adr/0012-tiered-quality-gates.md)
- [Sub-agent synchronization workflow](../../.github/skills/sub-agent-sync-workflow/SKILL.md)
- [Model policy](../../tools/config/agent-model-policy.json)
