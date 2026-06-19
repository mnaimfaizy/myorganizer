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

Prerequisite: `uv tool install graphifyy --with mcp` (provides `graphify` + `graphify-mcp`).
The `--with mcp` extra is **required** — without it `graphify-mcp` crashes with
`ModuleNotFoundError: No module named 'mcp'` and the MCP server in `.mcp.json` won't start.

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

> **Maintenance reality:** there is no commit hook wiring this up. The graph reflects the
> last manual build. Rebuild before relying on it for a fresh area of the code.
