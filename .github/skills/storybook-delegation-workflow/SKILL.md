---
name: storybook-delegation-workflow
description: 'Use when adding, editing, reviewing, or refactoring Storybook stories (`*.stories.tsx`) for MyOrganizer UI components. Delegate implementation to StorybookCurator, require requirement analysis first, and review for completeness, accessibility, and UX quality.'
argument-hint: 'Requirement summary + component path(s) + story file path(s) + expected states'
---

# Storybook Delegation Workflow

## Use This Skill When

- A task asks to create Storybook stories for a new UI component.
- A task asks to update existing stories after component behavior changes.
- A Storybook file needs UX-focused improvement (states, controls, docs clarity, edge scenarios).

## Core Rules

- Always delegate Storybook implementation to the `StorybookCurator` sub-agent.
- Do not create or edit `*.stories.tsx` directly in the main agent context when this workflow applies.
- The sub-agent must analyze requirement quality first (completeness, ambiguity, conflicts) before touching files.
- If requirements are incomplete, the sub-agent must stop and return targeted clarification questions.
- The sub-agent may disagree with the requested implementation when it would reduce quality (accessibility gaps, misleading stories, missing critical states, anti-patterns).
- The main agent acts as reviewer and may request a refinement pass when coverage quality is weak.
- If recurring Storybook mistakes are discovered, update references or docs so the same mistake is not repeated.

## Workflow

1. Build a delegation brief using [references/delegation-runbook.md](./references/delegation-runbook.md).
2. Delegate to `StorybookCurator` with explicit scope:
   - target component path(s)
   - target story path(s) or expected new file path
   - requirement summary
   - reference stories or design/system constraints
   - boundaries for creativity vs strict fidelity
3. Review the sub-agent output:
   - requirement analysis completed first?
   - gaps/clarifications surfaced clearly?
   - critical states represented?
   - a11y and UX concerns called out?
4. If needed, run a refinement delegation with concrete missing scenarios.
5. Finalize only when story coverage meaningfully supports component behavior and developer UX.

## Review Checklist (Main Agent)

- Does the story set cover primary and failure/edge states relevant to the component?
- Are controls/args realistic and useful for exploration?
- Is accessibility represented (labels, disabled states, keyboard-relevant scenarios)?
- Did the sub-agent challenge weak or risky requirements where appropriate?
- Did the output include specific clarification questions when requirements were incomplete?

## References

- `./references/delegation-runbook.md`
- `.github/agents/storybook-curator.agent.md`
- `docs/storybook/README.md`
- `libs/web-ui/AGENTS.md`
- `AGENTS.md`
