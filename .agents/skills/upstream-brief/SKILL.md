---
name: upstream-brief
description: Write one Upstream Brief comparing repo-owned instructions to official docs for the Ecosystems and Horizons the human names.
disable-model-invocation: true
argument-hint: 'ecosystem[@horizon] [ecosystem[@horizon] ...]'
---

# Upstream Brief

A user-invoked audit. The human names Ecosystems and, optionally, a Horizon for each. The run writes one **Upstream Brief** and, when there is a finding, proposes a HITL issue. It does not bump packages, apply instruction edits, or start a grill.

Load [ADAPTER.md](ADAPTER.md) when resolving the host adapter. Load [BRIEF.md](BRIEF.md) when writing the file. Load [REPORT.md](REPORT.md) when writing or validating the structured report the brief is rendered from.

## Guardrails

- Write the brief. Leave instruction files, hygiene scripts, and application code unchanged.
- Treat a finding as valid only when it cites a **primary** upstream page for the _named target version_ (official docs, vendor release notes, or a spec). The training corpus, blogs, and installed third-party skills are not sources.
- Record application-code mismatches and third-party-skill contradictions as **follow-on**. The proposed plan covers repo-owned instructions and hygiene/test scripts only.
- File an issue only after the human confirms. Omit `ready-for-agent` and any dependencies role.

## Workflow

### 1. Parse the run

Require one or more Ecosystem names, each optionally followed by a Horizon (example: `next nx@23 react-native`). An Ecosystem named with no Horizon still looks at what its own Baseline documents call deprecated or scheduled for removal — nothing further is asked.

**Done when:** every named Ecosystem is recorded, with its Horizon if one was given.

### 2. Resolve the adapter

Read `upstream-brief.config.yml` (also `.yaml` / `.json`) from the repo root. Missing keys take the defaults in [ADAPTER.md](ADAPTER.md). A missing file is not an error.

**Done when:** the Ecosystem declarations, the version-record path, instruction globs, brief directory, optional source/script globs, and optional issue map are known.

### 3. Resolve the Baseline

For each named Ecosystem, run the Baseline resolver
(`.agents/skills/upstream-brief/resolve-baseline.mjs`, built on the dependency-free
`baseline.mjs`) to get its lead's installed version (the Baseline), its member list, and any
drift notes against the version record. An Ecosystem whose lead is not installed is marked
**failed** and the run continues with the rest. Never invent a Baseline, and never read one from
the version record or a declared range (ADR 0084 item 1).

**Done when:** every named Ecosystem is either resolved to a Baseline or failed-closed.

> Steps 4-7 below still describe the pre-ADR-0084 shape (`subject`, a single research pass per
> subject, a Markdown-only brief). Migrating them to Ecosystem-wide workers, structured Upstream
> Findings, the skeptic hop, and the ledger is tracked in the PRD's later slices, not this one.

### 4. Load repo-owned instructions

Read files matching `instruction_globs`. Always exclude install and cache trees (`node_modules`, `.yarn`, `vendor`, `.git`, generated output). Those globs are repo-owned files only — third-party skill bodies are out of scope.

If `source_globs` or `script_globs` are set, _sample_ them for names the research hops return. Do not inventory the tree.

**Done when:** instruction text is loaded, and optional samples are ready.

### 5. Research hops

Launch one **research worker** per resolved subject. These are Independent Hops — they may run in parallel. Each worker:

1. Fetches primary upstream pages for that subject at the named target.
2. Compares those pages to the loaded instructions (and samples, if any).
3. Returns only future-risk, mismatch, and missed-improvement findings, each with a citation and local evidence.
4. Edits nothing.

If the host has a Research specialist, use it as the worker. Otherwise the same agent fetches the pages. A failed hop is recorded; the run continues.

**Done when:** every resolved subject has a worker result or a failure note.

### 6. Write the Upstream Brief

Write one Markdown file into the brief directory using [BRIEF.md](BRIEF.md). Name it `YYYY-MM-DD-upstream-brief-<subjects>.md`. Include failed subjects. A run with zero findings still writes the brief.

**Done when:** the file exists and every hop (success or failure) appears in it.

### 7. Propose a HITL issue

If the brief has **no** findings, stop. Say so, and point at the brief.

If it has at least one finding and the adapter has an issue map, present the proposed title, body (link the brief), and mapped labels (`research`, `quality`, `hitl` only). Wait for confirm. On yes, create the issue with the host tracker. On no, stop — the brief stays.

If there is no issue map, print the same proposal and stop.

**Done when:** the issue is filed, declined, or printed, and this skill has not started a grilling session.
