# Storybook Delegation Brief Template

Use this template when delegating Storybook work to `StorybookCurator`.

```markdown
## Objective

- What changed and why the story must be created/updated

## Component Scope

- Component file(s): <path>
- Current story file(s): <path or "new file expected">

## Required Story Outcomes

- Must-have scenarios:
  - <default>
  - <variant/state>
  - <error/empty/disabled/etc>
- Out of scope:
  - <explicitly excluded behavior>

## References

- Existing stories to mirror style: <path>
- Design constraints/tokens: <path or rule>
- UX/accessibility expectations: <short notes>

## Creativity Guardrails

- Strict fidelity areas:
  - <must follow exactly>
- Creative latitude:
  - <where sub-agent can improve/add sensible scenarios>

## Clarification Trigger

- If any required prop/state/interaction is undefined, stop and return clarification questions before editing.
```

## Minimum Acceptance Criteria

- Requirement analysis was performed before file edits.
- Clarification questions are returned when requirements are insufficient.
- Story set is useful for real UI review, not only a happy-path demo.
- Accessibility and UX concerns are explicitly surfaced.
