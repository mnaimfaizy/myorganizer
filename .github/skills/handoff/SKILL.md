---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: 'What will the next session be used for?'
disable-model-invocation: true
---

# Handoff

Adapted from `mattpocock/skills` for MyOrganizer workflows.

Write a handoff document summarizing the current conversation so a fresh agent can continue the work.

Save it to the temporary directory of the user's OS, not the current workspace.

Include a Suggested Skills section in the document with relevant repo-local skills (for example: `to-prd`, `to-issues`, `unit-test-delegation-workflow`, `playwright-e2e-workflow`, `release-and-deploy-workflow`, `grill-with-docs`).

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference those artifacts by path or URL.

Redact sensitive information such as API keys, passwords, tokens, or personally identifiable data.

If arguments are provided, treat them as what the next session will focus on and tailor the handoff accordingly.
