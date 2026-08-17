---
name: implement
description: Implement a piece of work based on a spec, PRD, or set of tickets. Use when the user wants hands-on delivery of an agreed plan in the current session.
disable-model-invocation: true
---

# Implement

Adapted from [mattpocock/skills — implement](https://github.com/mattpocock/skills/tree/main/skills/engineering/implement) for MyOrganizer workflows.

Implement the work described by the user in the spec, PRD, slice issue, ticket set, **or ad-hoc request** (no ticket required).

## Before you start

1. **Classify gate tier** (ADR 0012) and state it in your first reply:
   - Slice/issue with `gate:*` → use that label.
   - No ticket → apply `.claude/checklist.md` Step 0 mechanical criteria; when unsure → promote.
   - User may override the gate.
2. Confirm the spec source (issue body, PRD, slice ticket, user message, or path).
3. If the work targets a **GitHub issue**, load it with `gh issue view <N> --json number,title,state,labels,body` and note:
   - `## Blocked by` / `## Blocks`
   - whether it has `status:blocked` (do not start until blockers are done, unless the user explicitly overrides)
4. Read nearby `AGENTS.md` files for touched apps/libraries.
5. Check `.claude/checklist.md` before editing — route by **gate + file type**.

## Ad-hoc / no-ticket playbook

Use this when the user asks to fix or change something without a GitHub issue:

1. State `gate:mechanical | standard | full`.
2. Do **not** open IssueCreator unless the user wants a tracked ticket.
3. Execute the matching path from the checklist.
4. Run focused lint/tests; for `gate:full` (and large `standard` diffs), finish with `/code-review`.
5. Commit/PR only if the user asks.
6. Skip the issue unblock section below (no ticket).

Mechanical examples: fixture/type retarget, rename, dead-code delete, selector-only E2E string.  
Standard examples: one component props fix, one assertion suite update.  
Full examples: new page module, vault surface, API contract change.

## Implementation

Use **`/tdd`** (`.agents/skills/tdd/SKILL.md`) where possible, at pre-agreed test seams — still respect gate tier for who authors the tests.

When TDD is not appropriate, work in small vertical slices scoped to the spec.

Pick domain workflow skills when they apply:

- Frontend pages → `frontend-page-library-workflow`
- Backend APIs / API Contract → `backend-api-contract-change` (PrismaWriter → ApiWriter → ApiSync; do not write controllers or schema yourself on `standard`/`full`)
- Vault-backed data → `vault-feature-workflow`
- Auth/session → `auth-session-workflow`
- Prisma runbook (read by PrismaWriter) → `prisma-migration-workflow`
- YouTube integration → `youtube-integration-workflow`

Respect MyOrganizer structure: thin Next.js route wrappers in `apps/myorganizer`, page logic in `libs/web/pages/**`, shared code in `libs/**`.

## Validation loop

- Typecheck/lint affected projects: `yarn nx lint <project>` (and focused project tests as you go).
- Prefer single-file / focused Nx test targets while iterating; full suite once at the end.
- Do not re-run the same suite in Scaffold notes, Reviewer, and Runner — one authoritative execution after approval.
- After backend contract changes, run `yarn openapi:sync` and confirm with `yarn openapi:check`.

## Review before finishing

- `gate:mechanical`: short self-check (diff + focused tests); skip `/code-review` unless user asks.
- `gate:standard`: `/code-review` when the diff touches >2 behavioral files or the user asks.
- `gate:full`: use **`/code-review`** against the originating spec/tickets (or `main` merge-base if none).

## Complete a GitHub issue + unblock dependents (required when an issue was the target)

When `/implement` was invoked against a specific issue (slice or ad-hoc ticket), finish with this protocol. Same contract as `to-issues` / Sandcastle (ADR 0002).

### 1. Mark the current issue complete

```sh
gh issue edit <N> --repo mnaimfaizy/myorganizer \
  --remove-label status:in-progress \
  --add-label status:done

gh issue comment <N> --repo mnaimfaizy/myorganizer \
  --body "Implementation complete in this session. Unblocking dependents next."
```

Close the issue only when appropriate (AFK-style slices, or when the user asks):

```sh
gh issue close <N> --repo mnaimfaizy/myorganizer --reason completed
```

### 2. Discover dependents

Prefer the completed issue’s `## Blocks` section (`#M` refs).  
Fallback: search open issues that cite `#<N>` under `## Blocked by` (same PRD when `PRD: #…` is present).

### 3. Unblock each ready dependent

For every dependent that still has `status:blocked`:

1. Parse its `## Blocked by` list.
2. For each blocker, check `gh issue view <blocker> --json state,labels` — treat as satisfied if `state=CLOSED` **or** labels include `status:done`.
3. If **all** blockers are satisfied:

```sh
gh issue edit <dependent> --repo mnaimfaizy/myorganizer --remove-label status:blocked
gh issue comment <dependent> --repo mnaimfaizy/myorganizer \
  --body "Unblocked: #<completed> is done. Remaining blockers: none — ready for agent/human."
```

4. If any blocker remains open/incomplete, leave `status:blocked` and optionally comment which blockers remain.

### 4. Report

In the final reply, list: completed issue, dependents unblocked, dependents still blocked (and why).

Do **not** flip `type:hitl` → `type:afk` automatically — that remains a human decision.

## Commit and PR

Do **not** commit unless the user explicitly asks.

When the user requests a commit, use **`/commit`** (`.agents/skills/commit-change-workflow/SKILL.md`).

When the user requests a PR, use **`/create-pr`** (`.agents/skills/create-pull-request-workflow/SKILL.md`).
