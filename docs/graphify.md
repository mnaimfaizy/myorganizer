# Graphify structural index (opt-in agent supplement)

Graphify builds an AST-based code knowledge graph of the monorepo and serves it to agents
over MCP. We adopted it for **one narrow, proven win**: fast, free, in-package answers to
_"what directly calls / imports / consumes this symbol?"_ plus a god-node orientation map.
It is a **supplement to `CodeExplorer`/grep and `nx affected`, not a replacement.**

See issue #158 and `graphify-eval-notes.md` for the full evaluation. Scope was deliberately
limited because of measured blind spots (below).

## What it's good for

- `get_neighbors <symbol>` — direct callers/importers/consumers within reach (accurate, instant).
- `god_nodes` — most-connected nodes; good first orientation in an unfamiliar area.
- `query_graph "<question>"` — broad "what relates to X" context.
- The labeled `graphify-out/GRAPH_REPORT.md` — a navigable, domain-named community map for onboarding.

## What it must NOT be used for

- **Cross-package / cross-HTTP-boundary impact** ("what breaks if `VaultController` changes").
  The graph is AST-only and has no edge across the OpenAPI/codegen seam. **Use `nx affected
--files=<path>` instead** — it is authoritative for cross-project impact.
- **PR/slice review-priority ranking.** Graphify's `triage_prs` blast-radius counts a changed
  file's own community span, not its dependents, so it _inverts_ risk for hub/barrel files.
  Use `nx affected` for PR scoping.
- **TypeScript type-reference blast radius** (type usages aren't edges) or any symbol whose
  name appears in more than one file (it can't disambiguate).

Always confirm a graph result against the actual file before trusting it — the graph can be stale.

## On probation — usage is measured

This integration is **on probation**: a real-workflow spike showed an agent never invoked it
directly and its contribution (buried inside CodeExplorer) was unmeasurable. So CodeExplorer now
**queries Graphify first** for relationship questions and **logs the outcome** (`helped` /
`redundant` / `wrong/missed`) in a `Graphify Usage` block on every run. If those logs show it is
consistently `redundant` or `wrong/missed`, drop the integration — it is not worth the manual
rebuild + staleness cost. Keep it only if it earns a clear `helped` track record.

## Build / refresh

The graph is **not committed** (it's generated and goes stale). Build it once locally; the
`graphify` MCP server in `.mcp.json` then serves `graphify-out/graph.json`.

Prerequisite: `uv tool install "graphifyy[mcp]"` (provides `graphify` + `graphify-mcp`).
The `mcp` extra is **required** — without it `graphify-mcp` crashes with
`ModuleNotFoundError: No module named 'mcp'` and the MCP server in `.mcp.json` won't start.
Installing it via the `[mcp]` extra records `extras = ["mcp"]` in the uv receipt, so a later
`uv tool upgrade graphifyy` keeps it. Installing plain `graphifyy` drops the extra and silently
re-breaks the MCP server — the symptom in Claude Code is
`graphify: … ✘ Failed to connect — MCP error -32000: Connection closed`.

### Resync the skill after any version change

The `/graphify` skill under `~/.claude/skills/graphify/` is written by the CLI and is
**pinned to the version that wrote it**. Upgrading the package does not update it, so the two
drift apart and the CLI starts every command with:

```
warning: skill is from graphify 0.9.16, package is 0.9.37. Run 'graphify install' to update.
```

After **any** install, upgrade, or reinstall of `graphifyy`, resync it:

```pwsh
graphify install --platform claude   # rewrites ~/.claude/skills/graphify/{SKILL.md,references/}
```

This is a per-developer machine setup step, not a repo change — nothing here is committed.
Verify the whole chain with `graphify --version` (should match the warning-free CLI output)
and `claude mcp list` (should report `graphify: … ✔ Connected`).

### Build the graph

```pwsh
# Full rebuild (per-package extract + merge + cluster + label), zero external egress.
# Uses --backend claude-cli, which routes doc/image semantic extraction through the local
# Claude CLI (billed to your plan, no API key). Config files are excluded via .graphifyignore.
$env:GRAPHIFY_OUT="graphify-out"
graphify extract apps --backend claude-cli
graphify extract libs --backend claude-cli
graphify merge-graphs apps/graphify-out/graph.json libs/graphify-out/graph.json --out graphify-out/graph.json
graphify cluster-only . --no-viz
graphify label . --backend claude-cli      # domain names for communities + GRAPH_REPORT.md
```

Incremental refresh after code changes (much faster — reuses the content-hash cache):

```pwsh
graphify extract apps --backend claude-cli   # re-extracts only changed files
graphify extract libs --backend claude-cli
graphify merge-graphs apps/graphify-out/graph.json libs/graphify-out/graph.json --out graphify-out/graph.json
```

## Automatic refresh on commit

`.husky/post-commit` runs the incremental refresh above in the background after any commit that
touches `.ts/.tsx/.js/.jsx/.mjs/.cjs` under `apps/` or `libs/`. `git commit` returns immediately;
progress goes to `~/.cache/graphify-rebuild.log`.

It is a **no-op unless you have opted in** by installing graphify and building the graph once by
hand, so it costs nothing for contributors who do not use it. Specifically, it exits early when:

| Condition                                        | Why                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `graphify` is not on `PATH` or in `~/.local/bin` | Most contributors never install it                                                                                                |
| `graphify-out/` does not exist                   | The first build needs an LLM pass — keep it manual                                                                                |
| The commit touched no `apps/`/`libs/` source     | Doc and image changes must never trigger an LLM call from a hook                                                                  |
| You are in a linked worktree                     | `graphify-out/` belongs to the primary checkout; rebuilding from a worktree writes a rogue delta-only graph and races the primary |
| A rebase, merge, or cherry-pick is in progress   | A rebuild mid-sequence leaves unstaged output and blocks `--continue`                                                             |
| `GRAPHIFY_SKIP_HOOK=1` is set                    | Explicit opt-out                                                                                                                  |

Two environment settings in the hook are load-bearing, so do not drop them when editing it:

- `PYTHONHASHSEED=0` — networkx's louvain clustering iterates string-keyed sets whose order is
  randomised per process. Unpinned, repeated no-op refreshes were observed drifting
  (2,965 → 2,967 → 2,968 nodes); pinned, consecutive no-op refreshes hold steady at the same node
  and edge count. Without it you cannot tell a real change from clustering noise.
- `--backend claude-cli` — pinned on purpose. Without it graphify selects "whichever API key is
  set", and with `ANTHROPIC_BASE_URL` exported that would send source to an external endpoint.
  `claude-cli` keeps the rebuild local.

> **Maintenance reality:** the hook only covers **code**. Docs, images, community clustering, and
> the domain names in `GRAPH_REPORT.md` still need the manual `cluster-only` + `label` pass above.
> Rebuild by hand before relying on the report for a fresh area of the code.
