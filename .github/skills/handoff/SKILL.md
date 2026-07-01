---
name: handoff
description: Compact the current conversation into a handoff document for another session or agent to continue from.
argument-hint: 'What will the next session focus on?'
disable-model-invocation: true
---

# Handoff

Adapted from `mattpocock/skills` for MyOrganizer workflows.

Write a handoff document that allows a fresh session to continue work with minimal drift.

## Requirements

- Save the handoff document to the OS temporary/session area, **not** the repository workspace.
- Include: context summary, current status, open decisions, next concrete steps, and verification state.
- Include a **Suggested Skills** section listing relevant repo skills (for example: `to-prd`, `to-issues`, `unit-test-delegation-workflow`, `playwright-e2e-workflow`, `release-and-deploy-workflow`, `grill-with-docs`).
- Do not duplicate full content already present in PRDs/issues/ADRs/commits/diffs; reference those paths or URLs instead.
- Redact sensitive data (tokens, passwords, keys, personal data).
- If arguments are provided, tailor the handoff toward that next-session focus.
