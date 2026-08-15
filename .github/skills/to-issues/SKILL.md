---
name: to-issues
description: 'Use when a PRD Issue exists and needs to be broken into Slice Issues for autonomous agents. Reads the PRD, explores the codebase, drafts vertical slices (AFK/HITL), quizzes the user, and publishes each slice with the full label set. Always run to-prd first.'
---

# To Issues

Break a PRD Issue into independently-grabbable Slice Issues using tracer-bullet vertical slices.

## Use This Skill When

- A PRD Issue exists and needs to be decomposed into implementation tickets.
- The user asks to break down a PRD, create slice issues, or convert a plan into GitHub issues.
- Preparing work for `yarn dispatch-agents`.

## Core Rules

- Read `config.md` (sibling to this file) before doing anything else.
- The user must supply the PRD Issue number. If not provided, ask for it.
- Fetch the full PRD Issue body before drafting any slices — do not work from memory.
- Each slice must be a thin **vertical slice**: end-to-end through all layers (schema → API → UI → tests). Not a horizontal layer slice.
- A completed slice must be independently demoable or verifiable on its own.
- Every slice Issue body must begin with `PRD: #<parent-issue-number>` on the first line — this is how `dispatch-agents` links slices to their PRD.
- Quiz the user before publishing any issues. Publish only after explicit approval.
- Flag `type:hitl` slices prominently in the quiz: "⚠️ This slice is HITL — `dispatch-agents` will skip it until you unblock it manually."
- Publish issues in dependency order (blockers first) so you can reference real issue numbers in `## Blocked by` fields.
- Maintain **bidirectional** dependency links: every slice has `## Blocked by` and `## Blocks` (see Blocking / unblocking below).
- Apply `status:blocked` when creating any slice whose `## Blocked by` is non-empty. `dispatch-agents` skips `status:blocked` until dependents are unblocked.
- After publishing all slices, update the PRD Issue `## Slices` section with links to each created issue.
- Do NOT close or modify the PRD Issue body beyond the `## Slices` section.
- Do not include specific file paths or code snippets in issue bodies — they go stale. Exception: decision-rich prototype snippets (schema shape, state machine, type) — trim to the essential parts only.
- For each slice, assign a `gate:*` tier (ADR 0012) and detect which delegation pipelines apply under that gate (ComponentBuilder, TestScaffold, StorybookCurator). If a `gate:full` slice requires two or more non-trivial pipelines, flag it as a **split candidate** in the quiz — splitting keeps each agent iteration focused on one pipeline and prevents guardrail bypasses.
- When an acceptance criterion involves creating test files, suffix it with `(via TestScaffold — do not write directly)`. This removes the agent's rationalization surface for writing tests inline.

## Blocking / unblocking (required)

Dependency edges are part of the label + body contract (ADR 0002):

| Field / label    | Role                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| `## Blocked by`  | Upstream issues that must complete before this slice may start                 |
| `## Blocks`      | Downstream issues this slice unlocks when it completes                         |
| `status:blocked` | Machine-readable “not ready”; orchestrator and `/implement` skip until removed |

### When publishing slices

1. Publish **blockers first**.
2. For a slice with upstream deps:
   - Set `## Blocked by` to real `#N` issue numbers.
   - Add label `status:blocked` on create (`gh issue create ... --label status:blocked` or `gh issue edit --add-label status:blocked`).
3. After dependents exist, **edit each blocker** so its `## Blocks` lists those dependents (and set `## Blocks` to `None` when nothing depends on it).
4. Never leave a one-way edge: if A blocks B, A’s `## Blocks` must include B and B’s `## Blocked by` must include A.

### When a slice / issue completes (AFK or interactive)

Sandcastle does this automatically after a successful integrate. `/implement` must do the same when finishing a GitHub issue (see that skill).

1. Mark the completed issue `status:done` (and close with reason `completed` for AFK slices).
2. Read its `## Blocks` list (fallback: search open issues whose `## Blocked by` cites this number).
3. For each dependent still labelled `status:blocked`:
   - Re-read that dependent’s `## Blocked by`.
   - If **every** blocker is `CLOSED` or has `status:done`, remove `status:blocked` and comment that it was unblocked.
   - If any blocker remains open/incomplete, leave `status:blocked` on.

HITL note: `type:hitl` is separate from `status:blocked`. HITL needs a human to flip to `type:afk` (or otherwise unblock). Dependency blocking uses `status:blocked` + `## Blocked by` only.

## Workflow

1. **Read configuration**
   - Read `config.md` (same directory as this file).
   - Read `CONTEXT.md` for domain vocabulary.

2. **Fetch the PRD Issue**

   ```sh
   gh issue view <prd-issue-number> --repo mnaimfaizy/myorganizer
   ```

   Read the full body. Note the feature name and all Implementation Decisions.

3. **Explore the codebase (if needed)**
   - Delegate to `CodeExplorer` (`.github/agents/explore.agent.md`) focused on the seams listed in the PRD's Testing Decisions and Implementation Decisions.
   - Only explore areas relevant to slicing — do not re-explore what the PRD already captured.

4. **Draft slices (vertical, or wide-refactor when required)**
   - Prefer tracer-bullet **vertical** slices. Each cuts through ALL integration layers end-to-end.
   - **Exception — wide refactors:** if the work is one mechanical change whose **blast radius** fans across the codebase (rename a column, retype a shared symbol) so no vertical slice can land green, do **not** force a tracer bullet. Sequence **expand → migrate batches → contract** (see Reference below). Still assign `gate:*`, `complexity:*`, and blocking edges.
   - For each slice, assign:
     - **Type**: `type:afk` (agent can implement alone) or `type:hitl` (needs human decision)
     - **Complexity**: `complexity:low` / `complexity:medium` / `complexity:high` (model size)
     - **Gate**: `gate:mechanical` / `gate:standard` / `gate:full` (pipeline depth — ADR 0012)
     - **Blocked by**: which other slices (if any) must complete first
     - **Delegation pipelines** — detect which pipelines apply **under the chosen gate**:
       - `gate:mechanical` → prefer `direct edit` (fixture/type retarget, rename, delete, selector-only)
       - New or edited component behavior in `libs/web-ui/` or `libs/web/pages/` → `ComponentBuilder → ComponentReviewer` (`standard`/`full`)
       - New/behavioral test file → `TestScaffold → TestReviewer → TestRunner` (`standard`/`full`)
       - New or updated Storybook story → `StorybookCurator` (`standard`/`full`)
       - File moves, import path updates, config, docs → `direct edit`
         If two or more entries are non-`direct edit` on `gate:full`, mark the slice **split candidate ⚠️**.

5. **Quiz the user**

   Present the proposed breakdown as a numbered table:

   | #   | Title | Type    | Complexity | Gate       | Blocked by | Pipelines                                |
   | --- | ----- | ------- | ---------- | ---------- | ---------- | ---------------------------------------- |
   | 1   | ...   | AFK     | medium     | standard   | —          | ComponentBuilder                         |
   | 2   | ...   | AFK     | low        | mechanical | —          | direct edit                              |
   | 3   | ...   | HITL ⚠️ | high       | full       | #1         | ComponentBuilder, TestScaffold ⚠️ split? |

   Ask:
   - Does the granularity feel right? (too coarse / too fine)
   - Are dependency relationships correct?
   - Should any slices be merged or split?
   - Are HITL classifications correct?
   - Are `gate:*` assignments correct? (mechanical vs standard vs full)
   - Are there slices marked **split candidate ⚠️** (two or more delegation pipelines on `gate:full`)? Splitting them prevents agents from bypassing specialists under task pressure — one pipeline per slice is the target.

   Iterate until the user approves the full breakdown.

6. **Publish slice issues in dependency order**

   For each approved slice:

   ```sh
   gh issue create \
     --repo mnaimfaizy/myorganizer \
     --title "[Slice] <Feature Name>: <short description>" \
     --label "ready-for-agent" \
     --label "type:afk" \
     --label "complexity:medium" \
     --label "gate:standard" \
     --body "<issue body>"
   ```

   Defaults: missing `gate:*` → orchestrator treats as `gate:standard`. Use `gate:mechanical` for cleanup/retarget/verify-only slices; `gate:full` for new modules / vault / API contracts.

   If `## Blocked by` is not `None`, also pass `--label "status:blocked"`.

   After dependents are created, edit each blocker issue body so `## Blocks` lists them.

   Issue body format:

   ```
   PRD: #<prd-issue-number>

   ## What to build

   <Concise description of this vertical slice — end-to-end behaviour, not layer-by-layer.>

   ## Acceptance criteria

   - [ ] Criterion 1
   - [ ] Criterion involving a new test file (via TestScaffold — do not write directly)
   - [ ] Criterion involving a new component (via ComponentBuilder — do not write directly)

   ## Agent Workflow

   (Omit this section entirely when gate is mechanical / all work is direct file edits.)

   Required delegation pipelines for this slice under its gate:* — do NOT bypass on standard/full:
   - [ ] `ComponentBuilder → ComponentReviewer` for: <ComponentName>
   - [ ] `TestScaffold → TestReviewer → TestRunner` for: <SpecFileName.spec.tsx>
   - [ ] `StorybookCurator` for: <StoryFileName.stories.tsx>

   ## Blocked by

   - #<blocking-issue-number>

   (or `- None — can start immediately`)

   ## Blocks

   - #<dependent-issue-number>

   (or `- None — nothing waits on this slice`)
   ```

7. **Update the PRD Issue**

   Append each created issue to the PRD Issue's `## Slices` section:

   ```sh
   gh issue edit <prd-issue-number> \
     --repo mnaimfaizy/myorganizer \
     --body "<updated PRD body with slice links>"
   ```

   Slices section format:

   ```
   ## Slices

   | # | Title | Type | Complexity | Gate | Status |
   |---|---|---|---|---|---|
   | #N | [Slice title](issue-url) | AFK | medium | standard | open / blocked |
   ```

7b. **Wire `## Blocks` on blockers (required pass)**

After all slice numbers exist, ensure every blocker’s `## Blocks` section lists its dependents. Apply `status:blocked` to any dependent that still has unfinished blockers and is missing the label.

8. **Return a summary**

   ```
   SUCCESS: <N> slice issues created.
   PRD: <prd-issue-url>
   Slices: <comma-separated issue URLs>
   HITL slices (skipped by dispatch-agents): <list or "none">
   ```

## Validation

- Confirm all required labels (`ready-for-agent`, `type:afk`/`type:hitl`, `complexity:*`, `gate:*`, `status:blocked`) exist in the repo. If missing, instruct the user to run `yarn ai:create-labels`.
- Confirm every slice issue body starts with `PRD: #<N>`.
- Confirm every slice title starts with `[Slice] `.
- Confirm every slice has both `## Blocked by` and `## Blocks` sections.
- Confirm slices with non-empty `## Blocked by` carry `status:blocked`.
- Confirm blocker ↔ dependent edges are bidirectional.
- Confirm the PRD Issue `## Slices` section was updated after all slices are published.
- If the PRD is a wide refactor, confirm expand → migrate batches → contract ordering and blocking edges.

## Reference

### Vertical slice rules

- Each ordinary slice cuts a narrow but complete path through every layer (schema → API → UI → tests) — vertical, not a horizontal layer slice.
- A completed slice must be independently demoable or verifiable.
- Prefer one non-trivial delegation pipeline per `gate:full` slice (split candidates when two or more apply).

### Wide refactors (expand–contract)

Adapted from mattpocock/skills `to-tickets` (v1.1+).

A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the codebase so a single edit breaks many call sites at once and no vertical slice can land green.

Do **not** force it into a tracer bullet. Sequence it as **expand–contract**:

1. **Expand** — add the new form beside the old so nothing breaks (`gate:standard` or `gate:mechanical` as appropriate).
2. **Migrate** — move call sites over in batches sized by blast radius (per package / directory). Each batch is its own slice, **blocked by** the expand slice, keeping CI green because the old form still exists. Prefer `gate:mechanical` when the batch is pure retargets.
3. **Contract** — delete the old form once no caller remains, in a slice **blocked by** every migrate batch.

When even the batches cannot stay green alone, keep the sequence but let them share an integration branch that all block a final **integrate-and-verify** slice — green is promised only there. Mark that final slice `type:hitl` if a human must confirm the cutover.

Still use bidirectional `## Blocked by` / `## Blocks` and `status:blocked` as elsewhere in this skill.

## References

- `config.md` — label vocabulary, issue formats, model routing
- `.github/agents/explore.agent.md` — codebase exploration
- `CONTEXT.md` — domain language glossary
- `docs/adr/0002-agent-orchestration-label-vocabulary.md` — label ADR
- `docs/adr/0012-tiered-quality-gates.md` — gate tiers
- `.github/skills/to-prd/SKILL.md` — prerequisite skill
- `.sandcastle/main.mts` — orchestrator that picks up AFK slices
