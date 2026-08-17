---
name: upstream-brief
description: Write one Upstream Brief comparing repo-owned instructions to official docs for subjects and target versions the human names.
disable-model-invocation: true
argument-hint: 'subject@version [subject@version ...]'
---

# Upstream Brief

A user-invoked audit. The human names subjects and target versions. The run writes one **Upstream Brief** and, when there is a finding, proposes a HITL issue. It does not bump packages, apply instruction edits, or start a grill.

Load [ADAPTER.md](ADAPTER.md) when resolving the host adapter. Load [BRIEF.md](BRIEF.md) when writing the file.

## Guardrails

- Write the brief. Leave instruction files, hygiene scripts, and application code unchanged.
- Treat a finding as valid only when it cites a **primary** upstream page for the _named target version_ (official docs, vendor release notes, or a spec). The training corpus, blogs, and installed third-party skills are not sources.
- Record application-code mismatches and third-party-skill contradictions as **follow-on**. The proposed plan covers repo-owned instructions and hygiene/test scripts only.
- File an issue only after the human confirms. Omit `ready-for-agent` and any dependencies role.

## Workflow

### 1. Parse the run

Require one or more `subject@version` tokens (example: `next@16 react@19 node@24`). If any subject lacks a target version, ask once and stop.

**Done when:** every subject has a human-named target, or the run has stopped.

### 2. Resolve the adapter

Read `upstream-brief.config.yml` (also `.yaml` / `.json`) from the repo root. Missing keys take the defaults in [ADAPTER.md](ADAPTER.md). A missing file is not an error.

**Done when:** current-version source, instruction globs, brief directory, optional source/script globs, and optional issue map are known.

### 3. Resolve current versions

For each subject, read the current version from the adapter source. If a subject cannot be resolved, mark it **failed** and continue. Do not invent a version. Do not fetch “latest.”

**Done when:** every subject is either resolved or failed-closed.

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
