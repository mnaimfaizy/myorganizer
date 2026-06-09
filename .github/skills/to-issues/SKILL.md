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
- After publishing all slices, update the PRD Issue `## Slices` section with links to each created issue.
- Do NOT close or modify the PRD Issue body beyond the `## Slices` section.
- Do not include specific file paths or code snippets in issue bodies — they go stale. Exception: decision-rich prototype snippets (schema shape, state machine, type) — trim to the essential parts only.
- For each slice, detect which mandatory delegation pipelines apply (ComponentBuilder, TestScaffold, StorybookCurator). If a slice requires two or more non-trivial pipelines, flag it as a **split candidate** in the quiz — splitting keeps each agent iteration focused on one pipeline and prevents guardrail bypasses.
- When an acceptance criterion involves creating test files, suffix it with `(via TestScaffold — do not write directly)`. This removes the agent's rationalization surface for writing tests inline.

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

4. **Draft vertical slices**
   - Break the PRD into tracer-bullet slices. Each slice cuts through ALL integration layers end-to-end.
   - For each slice, assign:
     - **Type**: `type:afk` (agent can implement alone) or `type:hitl` (needs human decision)
     - **Complexity**: `complexity:low` / `complexity:medium` / `complexity:high`
     - **Blocked by**: which other slices (if any) must complete first
     - **Delegation pipelines** — detect which mandatory pipelines apply to this slice:
       - New or edited component in `libs/web-ui/` or `libs/web/pages/` → `ComponentBuilder → ComponentReviewer`
       - New test file (`*.spec.tsx` / `*.test.ts`) → `TestScaffold → TestReviewer → TestRunner`
       - New or updated Storybook story (`*.stories.tsx`) → `StorybookCurator`
       - File moves, import path updates, config, docs → `direct edit`
         If two or more entries are non-`direct edit`, mark the slice **split candidate ⚠️**.

5. **Quiz the user**

   Present the proposed breakdown as a numbered table:

   | #   | Title | Type    | Complexity | Blocked by | Pipelines                                |
   | --- | ----- | ------- | ---------- | ---------- | ---------------------------------------- |
   | 1   | ...   | AFK     | medium     | none       | ComponentBuilder, TestScaffold ⚠️ split? |
   | 2   | ...   | HITL ⚠️ | high       | #1         | direct edit                              |

   Ask:
   - Does the granularity feel right? (too coarse / too fine)
   - Are dependency relationships correct?
   - Should any slices be merged or split?
   - Are HITL classifications correct?
   - Are there slices marked **split candidate ⚠️** (two or more delegation pipelines)? Splitting them prevents agents from bypassing TestScaffold or ComponentBuilder under task pressure — one pipeline per slice is the target.

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
     --body "<issue body>"
   ```

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

   (Omit this section entirely when all work is direct file edits — e.g. import updates, config, docs.)

   Required delegation pipelines for this slice — do NOT bypass these:
   - [ ] `ComponentBuilder → ComponentReviewer` for: <ComponentName>
   - [ ] `TestScaffold → TestReviewer → TestRunner` for: <SpecFileName.spec.tsx>
   - [ ] `StorybookCurator` for: <StoryFileName.stories.tsx>

   ⚠️ Do NOT write these file types directly, even to verify your own work:
   - `*.spec.tsx` / `*.test.ts` → always use TestScaffold
   - Components in `libs/web-ui/` or `libs/web/pages/` → always use ComponentBuilder

   ## Blocked by

   - #<blocking-issue-number>

   (or "None — can start immediately")
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

   | # | Title | Type | Complexity | Status |
   |---|---|---|---|---|
   | #N | [Slice title](issue-url) | AFK | medium | open |
   ```

8. **Return a summary**

   ```
   SUCCESS: <N> slice issues created.
   PRD: <prd-issue-url>
   Slices: <comma-separated issue URLs>
   HITL slices (skipped by dispatch-agents): <list or "none">
   ```

## Validation

- Confirm all required labels (`ready-for-agent`, `type:afk`/`type:hitl`, `complexity:*`) exist in the repo. If missing, instruct the user to run `yarn ai:create-labels`.
- Confirm every slice issue body starts with `PRD: #<N>`.
- Confirm every slice title starts with `[Slice] `.
- Confirm the PRD Issue `## Slices` section was updated after all slices are published.

## References

- `config.md` — label vocabulary, issue formats, model routing
- `.github/agents/explore.agent.md` — codebase exploration
- `CONTEXT.md` — domain language glossary
- `docs/adr/0002-agent-orchestration-label-vocabulary.md` — label ADR
- `.github/skills/to-prd/SKILL.md` — prerequisite skill
- `.sandcastle/main.ts` — orchestrator that picks up AFK slices
