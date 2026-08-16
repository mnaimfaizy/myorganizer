# Tiered quality gates for AFK and interactive agent work

Mandatory multi-agent chains (TestScaffold → TestReviewer → TestRunner, ComponentBuilder → ComponentReviewer, etc.) preserve quality on structural work but over-tax mechanical and exploratory slices — including local/interactive sessions with no ticket. We adopt **tiered quality gates** so the same policy applies to Sandcastle AFK and Cursor/Claude interactive work: depth scales with risk, not with file extension alone.

## Status

accepted — Gated Pipeline retry cap amended by [ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md) (3 → 2 reject-cycles)

## Decision

Quality depth is selected by a **gate tier**, not by “always full pipeline.” Deterministic checks (`tsc`, `eslint`, focused jest) stay mandatory at every tier. Multi-agent specialist chains are reserved for behavioral and structural risk.

### Gate tiers

| Tier              | When                                                                                                                                                      | Allowed execution                                                                                                   | Required gates                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate:mechanical` | Fixture/type retarget, rename, delete dead code, selector-only E2E string fix, already-satisfied AC verification, import/path fix with no behavior change | Main agent may edit directly (interactive or AFK)                                                                   | Focused lint + focused tests (or `tsc` for type-only). No specialist chain. Short report (≤5 bullets).                                                          |
| `gate:standard`   | Single-surface behavior change: one component props/state fix, one schema field, one assertion suite update                                               | One specialist hop when that artifact type changes (e.g. TestScaffold **or** ComponentBuilder), not both by default | Specialist + matching Reviewer **or** Runner once. Collapse redundant re-runs. Cap retries at 2 ([ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md)). |
| `gate:full`       | New UI primitive/feature module, vault/crypto, API contract, multi-file product behavior, ambiguous UX                                                    | Current mandatory chains. **API Contract** uses One-shot Specialists (ADR 0015), not a Gated Pipeline.              | Full documented pipelines. ComponentReviewer retry cap = 2 (mirror test pipeline; [ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md)). API Contract: PrismaWriter → ApiWriter → ApiSync, then leave. |

### Session modes (same tiers, different entry)

| Mode                       | Entry                                        | How the tier is chosen                                                                                                                                             |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AFK / Sandcastle**       | Slice issue with labels                      | `to-issues` applies `gate:*` (+ existing `complexity:*`). Orchestrator injects the matching prompt rules.                                                          |
| **Interactive + ticket**   | User points at an issue / PRD slice          | Main agent reads labels (or infers from issue body) and follows the same tier.                                                                                     |
| **Interactive, no ticket** | Ad-hoc (“fix this”, “retarget this fixture”) | Main agent classifies via `.claude/checklist.md` Step 0 (risk questions) → picks a tier → states the tier in the first reply. User can override (“use full gate”). |

Ad-hoc work does **not** require IssueCreator or a GitHub ticket. Tickets remain the path for planned features, triage, and AFK dispatch.

### Mechanical classification (escape hatch)

A change is `gate:mechanical` only if **all** are true:

1. No new product behavior or public API contract.
2. Diff is localized (prefer ≤2 files; larger only if pure rename/delete).
3. Assertions/stories either unchanged or only retarget fixtures/types to match an already-landed domain model.
4. Success is decidable by deterministic checks alone.

If any check fails → promote to `gate:standard` or `gate:full`. When unsure → promote (never demote).

### Label vocabulary extension (AFK contract)

Extends ADR 0002:

| Label             | Meaning                                                  |
| ----------------- | -------------------------------------------------------- |
| `gate:mechanical` | AFK agent must use mechanical path; no specialist chains |
| `gate:standard`   | Single-hop specialist path                               |
| `gate:full`       | Full mandatory pipelines                                 |

`complexity:*` continues to select **model size**. `gate:*` selects **pipeline depth**. They are independent (e.g. `complexity:low` + `gate:mechanical`, or `complexity:high` + `gate:full`).

Default when missing: `gate:standard` for AFK (safer than mechanical); interactive no-ticket defaults to classification at session start.

### Report and handoff discipline (all modes)

Specialist agents return **machine-short** verdicts:

- `PASS | FAIL | ESCALATE`
- ≤5 bullets of rationale
- Exact command(s) already run

No novel-length checklist dumps unless `gate:full` and the reviewer rejected once.

### Explicit non-goals

- This does **not** remove GUIDELINES, behavior matrices, or vault safety rules for structural work.
- This does **not** authorize plaintext vault APIs or skipping OpenAPI sync after contract changes.
- API Contract execution is One-shot Specialists (ADR 0015), not ComponentBuilder-style retry loops.
- This does **not** make E2E autonomous in Sandcastle (still structural-only per ADR 0004).

## Considered Options

- **Keep NO EXCEPTIONS forever** — Rejected: proven cost-compounding on mechanical slices (e.g. fixture retarget paying full TestScaffold → Reviewer → Runner).
- **Separate interactive vs AFK policies** — Rejected: doubles maintenance and invites checklist drift; one tier vocabulary with two entry modes is enough.
- **Model downgrade only (always full chains on Haiku)** — Rejected: call count and handoff duplication dominate cost more than model tier alone.
- **Ticket-required for all agent work** — Rejected: interactive friction without quality gain for mechanical ad-hoc edits.

## Consequences

- Update `.claude/checklist.md`, `CLAUDE.md`, `AGENTS.md` to replace absolute “NO EXCEPTIONS” with tiered rules + mechanical criteria.
- Extend `to-issues` / `create-labels` with `gate:*`; teach Sandcastle prompt builder to inject tier rules.
- Add ComponentReviewer max-retry = 2 (parity with unit-test pipeline; [ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md) amended 3 → 2).
- Extend `/implement` and `/ask-matt` with an **ad-hoc, no-ticket** playbook that classifies gate tier first.
- Align Cursor premium models on static gates (TestReviewer) with cost policy unless benchmarks justify otherwise.
- Fix stale checklist pointer to missing `.claude/commands/component-builder.md`.
