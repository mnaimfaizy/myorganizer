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
| `type:afk`           | Agent can implement and merge without human interaction |
| `type:hitl`          | Human decision required before agent can proceed        |
| `status:in-progress` | Agent has picked up the issue                           |
| `status:done`        | Agent finished; PR opened                               |
| `prd`                | Parent PRD Issue for a planned feature                  |

## Model Routing

| Label               | Model               |
| ------------------- | ------------------- |
| `complexity:low`    | `claude-haiku-4-5`  |
| `complexity:medium` | `claude-sonnet-4-6` |
| `complexity:high`   | `claude-opus-4-5`   |

## Issue Formats

### PRD Issue

- **Title format**: `[PRD] <Feature Name>`
- **Labels**: `prd`, `ready-for-agent`
- **Body**: Full PRD using the to-prd template. Must include a `## Slices` section (initially empty — `to-issues` populates it).
- **Created by**: `to-prd` skill via `gh issue create` directly (not via IssueCreator agent).

### Slice Issue

- **Title format**: `[Slice] <Feature Name>: <short description>`
- **Labels**: `ready-for-agent` + `type:afk` or `type:hitl` + one `complexity:*` label
- **Body**: Must include `PRD: #<parent-issue-number>` on the first line. Then acceptance criteria, affected libs, test seams.
- **Created by**: `to-issues` skill via IssueCreator agent.

## PR Strategy (Hybrid)

1. `dispatch-agents` creates a feature branch (`feat/<slugified-prd-title>`) from `main` at run-start.
2. Each AFK Slice agent opens a PR targeting the feature branch (not `main`).
3. After all slice PRs are reviewed and merged into the feature branch, a final PR from the feature branch to `main` is created manually.

## Trigger Command

```sh
yarn dispatch-agents --prd <prd-issue-number>
```

## Orchestrator Behaviour

- Only picks up issues labelled `ready-for-agent` + `type:afk`.
- Skips `type:hitl` issues — these require human unblocking first.
- Reads `complexity:*` label to select model for each slice.
- Posts a comment on each slice issue when the agent completes.
- Sends a desktop notification when the full batch is done.

## References

- ADR: `docs/adr/0002-agent-orchestration-label-vocabulary.md`
- Domain glossary: `CONTEXT.md`
- Orchestrator: `.sandcastle/main.ts`
