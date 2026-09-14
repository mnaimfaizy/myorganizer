# Sub-agent tool grants are derived from canonical roles

## Status

accepted

## Context

Every canonical sub-agent body in `.github/agents/*.agent.md` declares its capabilities by role:
`tools: [read, search, execute]`. Until this decision nothing read that line. `sync-subagents.mjs`
wrote one fixed `defaultTools` block per harness when it first created a file, and after that
preserved the file's frontmatter verbatim and never compared it again. Grants in `.claude/agents`,
`.cursor/agents`, and `.gemini/agents` were therefore whatever a file happened to be born with or
hand-edited to, and `yarn agents:sync:check` could not go red on them.

Measured on 2026-09-14 across 23 agents, that produced three defect classes (issue #421):

- **Over-grant.** Eleven Claude agents whose roles omit `edit` held `Edit` and `Write`, four of them
  contradicting their own bodies ("Read-only", "does not create the commit").
- **Under-grant.** `research` declared `web` but held no web tool, which is how #420 was found.
  `test-scaffold` and `storybook-curator` could not create files (fixed separately in #425).
- **Invalid names.** The Gemini default block used `list_files`, `search_files`, and
  `replace_in_file`, none of which are Gemini CLI tools. Every Gemini agent was effectively without
  search and in-place edit.

A map from roles to Claude tools reproduced six of eight hand-tuned Claude files exactly, without
being told about them. The two it did not reproduce were the two files already known to be wrong.
That is the evidence the roles are the right source.

## Decision

**The canonical role list is authoritative for tool grants; `tools/config/agent-tool-map.json`
translates it; `sync-subagents.mjs` renders and enforces the result.**

- The map holds the role vocabulary (seven roles, none new) and, per harness, what each role
  renders to. A harness that uses a role vocabulary entry must map it, and an agent declaring a role
  outside the vocabulary is a hard error. No cell may be silently omitted.
- Grants render in vocabulary order, so declaration order in a body is never drift.
- `--check` reports `toolDrift` when a file's grant differs from the rendering, and fails.
  `--apply` rewrites **only** the grant lines, leaving every other frontmatter key as written, and
  prints each change with widenings labelled apart from narrowings.
- Cases the vocabulary cannot express go in the map's `overrides`, keyed by agent then harness, and
  each needs a written `reason`. The block ships empty; a recurring override should become a role.
- **Cursor is enforced through `readonly`, coarsely.** Cursor subagents have no per-agent tool list;
  tools are inherited from the parent, and the only capability key is `readonly`, which blocks file
  edits and state-changing shell commands. An agent is `readonly: true` unless it declares `edit` or
  `execute`. Agents that run commands with side effects but do not edit files (e.g. `api-sync`, whose
  `yarn openapi:sync` writes) are left writable, because `readonly` would break them. The finer
  distinction is a documented gap, not a silent one.
- **`execute` is not split.** The two agents that looked like a case for splitting it
  (`preflight-check`, `version-bump`, both `[execute]` alone) had incomplete roles, not a need to
  separate running a build from running anything. Their roles were corrected instead.

Copilot has no map entry: `.github/agents` is canonical and already carries the roles verbatim.

This supersedes in part [ADR 0038](0038-component-builder-scoped-bash-for-prototypes.md), whose
consequences describe grant changes as hand-edits to each harness file. Its decision stands.

## Considered Options

- **A second policy file keyed by agent**, the shape of `agent-model-policy.json` — rejected. Model
  pins have no natural home in the body; capability roles already have one, and splitting them would
  put two places to edit behind every change to an agent's job.
- **Keep preserving target frontmatter verbatim** — rejected. The property it protected (defaults
  must not silently widen a hand-tuned grant) is kept by other means: under the map a grant can only
  widen through a reviewed change to a canonical role or to the map, `--check` never writes, and
  `--apply` labels every widening.
- **Omit Cursor from enforcement** — rejected. `readonly` is coarse, but it is real for the four
  agents that neither edit nor execute, and leaving Cursor out would make its gap invisible.
- **Render the five Graphify tool names individually for Gemini** — rejected. Gemini CLI documents
  `mcp_<server>_*` wildcards, so `mcp_graphify_*` is exact.

## Consequences

- Narrowing `Edit`/`Write` on an agent that keeps `execute` aligns the grant with the body; it is
  not a sandbox, because a shell can still write. Body guardrails and the `ai:commit` /
  `ai:create-pr` runners remain the enforcement for those agents.
- Changing what an agent may do is now a one-line change to its canonical role followed by
  `yarn agents:sync`, and the diff shows every harness file the grant reaches.
- Harness tool names are a fact about the harness that can change. The map carries `reviewedAt` and
  its sources; a renamed tool is fixed once in the map, not per file.
- `yarn agents:sync:test` covers the renderer and now runs in CI, so the rules cannot regress
  unnoticed.
- Whether Gemini CLI rejects or ignores an unknown tool name was not verified. It no longer matters
  for correctness, since no unknown name is rendered, but it decides whether the old Gemini grants
  failed loudly or silently.
