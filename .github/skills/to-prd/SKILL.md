---
name: to-prd
description: 'Use when the user wants to plan a new feature for MyOrganizer. Explores the codebase, sketches test seams, gets user approval, writes a PRD, and publishes it as a GitHub Issue. Always use this skill for planned features — not for ad-hoc bugs or one-off tasks.'
---

# To PRD

Turn the current conversation context into a Product Requirements Document and publish it as a GitHub Issue.

## Use This Skill When

- The user wants to plan a new feature, capability, or significant change to MyOrganizer.
- The user asks to write a PRD, create a spec, or turn an idea into a structured plan.
- The user wants to prepare work for autonomous agents via `dispatch-agents`.

## Core Rules

- Read `config.md` (sibling to this file) before doing anything else. It contains the label vocabulary, issue formats, and model routing used throughout this skill.
- Read `CONTEXT.md`, `TECH_STACK.md`, and any relevant `docs/adr/` files to ground the PRD in the project's domain language and documented decisions.
- Do NOT interview the user — synthesise from the current conversation context and codebase.
- Do NOT use the IssueCreator agent for the PRD Issue. Create it directly via `gh issue create` — the PRD Issue uses a different template and label set than ad-hoc issues.
- The PRD Issue body must include a `## Slices` section (initially containing only `_To be populated by to-issues._`). The `to-issues` skill will populate it.
- Always present test seams to the user for approval before writing the full PRD. This is the only interactive step.
- Apply labels `prd` and `ready-for-agent` to the published issue. No other labels.
- Use domain vocabulary from `CONTEXT.md`. Do not use avoided terms.
- Do not include specific file paths or code snippets in the PRD body — they go stale. Exception: prototype snippets that encode a decision more precisely than prose can (state machine, schema shape, reducer) — inline only the decision-rich parts.

## Workflow

1. **Read configuration and context**
   - Read `config.md` (same directory as this file).
   - Read `CONTEXT.md` for domain vocabulary.
   - Read `TECH_STACK.md` for current stack.
   - Scan `docs/adr/` for decisions in the affected area.

2. **Explore the codebase**
   - Delegate to the `CodeExplorer` sub-agent (`.github/agents/explore.agent.md`) to map the current state of any areas affected by the feature.
   - Focus on: existing seams (API boundaries, service interfaces, component entry points), test patterns in the affected area, vault implications if sensitive data is involved.

3. **Sketch test seams**
   - Identify the highest-level seams at which the feature can be verified. Prefer existing seams over new ones.
   - Present a short numbered list: `1. <seam> — <what passes/fails at this seam>`
   - Ask the user: "Do these seams match your expectations? Any to add, remove, or change?"
   - Wait for approval before proceeding.

4. **Write the PRD**
   Use the template below. Keep the **User Stories** list extensive — cover all actors and edge cases.

```
## Problem Statement

<The problem from the user's perspective.>

## Solution

<The solution from the user's perspective.>

## User Stories

<Numbered list — cover all actors, happy paths, and edge cases.>
1. As a <actor>, I want <feature>, so that <benefit>

## Implementation Decisions

<List of decisions: modules to build/modify, interface changes, schema changes, API contracts, architectural choices, vault implications if applicable. No file paths. No working-demo code — only decision-rich snippets.>

## Testing Decisions

<What makes a good test for this feature. Which modules will be tested. Prior art in the codebase (similar test patterns).>

## Out of Scope

<Explicit list of what this PRD does not cover.>

## Slices

_To be populated by to-issues._

## Further Notes

<Any remaining context.>
```

5. **Publish the PRD Issue**

   ```sh
   gh issue create \
     --repo mnaimfaizy/myorganizer \
     --title "[PRD] <Feature Name>" \
     --label "prd" \
     --label "ready-for-agent" \
     --body "<PRD body>"
   ```

6. **Return the result**

   ```
   SUCCESS: <issue-url>
   ```

## Validation

- Confirm `prd` and `ready-for-agent` labels exist in the repo before creating the issue. If missing, instruct the user to run `yarn ai:create-labels` first.
- Confirm the issue body contains a `## Slices` section.
- Confirm the issue title starts with `[PRD] `.

## References

- `config.md` — label vocabulary, issue formats, model routing
- `.github/agents/explore.agent.md` — codebase exploration
- `CONTEXT.md` — domain language glossary
- `TECH_STACK.md` — current stack and package versions
- `docs/adr/0002-agent-orchestration-label-vocabulary.md` — label ADR
- `.github/skills/to-issues/SKILL.md` — next step after PRD is published
