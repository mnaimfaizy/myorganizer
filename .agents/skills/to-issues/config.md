# to-prd / to-issues Configuration

## Repository

`mnaimfaizy/myorganizer`

## Issue Tracker

GitHub Issues

## Label Vocabulary

| Label                | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| `ready-for-agent`    | Orchestrator may pick this issue up                     |
| `complexity:low`     | Route to Haiku — simple, well-scoped task               |
| `complexity:medium`  | Route to Sonnet — moderate complexity                   |
| `complexity:high`    | Route to Opus — complex, deep reasoning required        |
| `gate:mechanical`    | Mechanical path — no specialist chains (ADR 0012)       |
| `gate:standard`      | Single-hop specialist path (ADR 0012)                   |
| `gate:full`          | Full mandatory pipelines (ADR 0012)                     |
| `type:afk`           | Agent can implement and merge without human interaction |
| `type:hitl`          | Human decision required before agent can proceed        |
| `status:in-progress` | Agent has picked up the issue                           |
| `status:blocked`     | Waiting on `## Blocked by` deps — skipped until cleared |
| `status:done`        | Agent finished; integrated into local feature branch    |
| `prd`                | Parent PRD Issue for a planned feature                  |

Kind and area Surface Labels (issues and PRs) live in `tools/config/github-labels.json`. `to-prd` / `to-issues` do not apply them. See [ADR 0025](../../../docs/adr/0025-pr-surface-labels.md).

## Model Routing

`complexity:low | medium | high` selects the corresponding Sandcastle model from `tools/config/agent-model-policy.json`. Do not duplicate concrete model IDs here.

## Issue Formats

### PRD Issue

- **Title format**: `[PRD] <Feature Name>`
- **Labels**: `prd`, `ready-for-agent`
- **Body**: Full PRD using the to-prd template. Must include a `## Slices` section (initially empty — `to-issues` populates it).
- **Created by**: `to-prd` skill via `gh issue create` directly (not via IssueCreator agent).

### Slice Issue

- **Title format**: `[Slice] <Feature Name>: <short description>`
- **Labels**: `ready-for-agent` + `type:afk` or `type:hitl` + one `complexity:*` + one `gate:*` (default `gate:standard` if omitted) + `status:blocked` when `## Blocked by` is non-empty
- **Body**: Must include `PRD: #<parent-issue-number>` on the first line, plus `## Blocked by` and `## Blocks` sections. Then acceptance criteria, affected libs, test seams.
- **Created by**: `to-issues` skill via `gh issue create` directly (not via IssueCreator agent).
- **Unblock**: when a slice completes, remove `status:blocked` from dependents whose blockers are all `status:done` / closed (Sandcastle + `/implement`).

## Integration Strategy (local-only)

1. `dispatch-agents` creates the feature branch (`feat/<slugified-prd-title>`) from `origin/main` **locally — it is never pushed**.
2. AFK slices run one at a time; each agent commits on its slice branch and the orchestrator **fast-forwards it into the local feature branch** after a lint gate. No per-slice push, no per-slice PR.
3. After QA, the feature branch is pushed and **one** PR from it to `main` is created manually; CI runs there. See `docs/adr/0010`.

## Trigger Command

```sh
yarn dispatch-agents --prd <prd-issue-number>
```

## Orchestrator Behaviour

- Only picks up issues labelled `ready-for-agent` + `type:afk`.
- Skips `type:hitl` issues — these require human unblocking first.
- Reads `complexity:*` label to select model for each slice.
- Reads `gate:*` label to select pipeline depth (default `gate:standard`); see ADR 0012.
- Skips issues labelled `status:blocked` until dependents are unblocked after blockers complete.
- On successful integrate: labels `status:done`, closes the slice, and removes `status:blocked` from dependents whose `## Blocked by` deps are all done.
- Posts a comment on each slice issue when the agent completes.
- Sends a desktop notification when the full batch is done.

## References

- ADR: `docs/adr/0002-agent-orchestration-label-vocabulary.md`
- Gate tiers: `docs/adr/0012-tiered-quality-gates.md`
- Domain glossary: `CONTEXT.md`
- Orchestrator: `.sandcastle/main.mts`
