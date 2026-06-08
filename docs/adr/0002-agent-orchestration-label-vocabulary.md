# GitHub labels as the coordination contract between planning tools and autonomous agents

We need a machine-readable signal that connects three systems: planning tools (`to-prd`, `to-issues`), GitHub Issues, and the sandcastle orchestrator (`dispatch-agents`). We chose GitHub labels as that contract rather than GitHub Projects, Milestones, or issue metadata fields.

The full label vocabulary:

| Label                | Meaning                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `ready-for-agent`    | Orchestrator may pick this issue up                                   |
| `complexity:low`     | Route to Haiku                                                        |
| `complexity:medium`  | Route to Sonnet                                                       |
| `complexity:high`    | Route to Opus                                                         |
| `type:afk`           | Agent can implement and merge without human interaction               |
| `type:hitl`          | Human decision required before agent can proceed — orchestrator skips |
| `status:in-progress` | Agent has picked up the issue                                         |
| `status:done`        | Agent finished; PR opened                                             |

`to-issues` applies `ready-for-agent` + `type:*` + `complexity:*` at creation time. The orchestrator filters on `ready-for-agent` + `type:afk` and reads `complexity:*` to select the model.

## Considered Options

- **GitHub Projects** — supports custom fields and status columns, but requires Projects API; labels are simpler and visible on the issue list without navigating to a board.
- **GitHub Milestones** — groups issues but carries no machine-readable type or complexity signal.
- **Issue metadata / custom properties** — more structured, but not readable in the issue body and requires GitHub Enterprise for full support.

## Consequences

The label names are a shared contract. Renaming a label requires updating the orchestrator source (`dispatch-agents` filter logic) and re-labelling all open issues simultaneously. Do not rename labels without a migration script.
