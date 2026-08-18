# Gated Pipelines cap at two reject-cycles; `/code-review` runs once per Slice

Slice #271 showed that a 3-cycle Component and Jest retry loop burns tokens on the same FAIL, while `/code-review` (Standards + Spec) found the one real product defect — but only after every other seam had already been verified. We keep both Gated Pipelines. We do not turn them into One-shot Specialists, and we do not use `/code-review` as a substitute for ComponentReviewer or TestRunner.

## Decision

- **Retry cap is 2** reject-cycles (reviewer-rejects-back-to-writer), then escalate. Amends ADR 0004, ADR 0012, and the ComponentReviewer cap in ADR 0014’s orbit. One cheap retry for a typo; no third novel on the same lint rule.
- **After escalate**, the orchestrator fixes (a sibling pattern, derive-during-render, mock hygiene). Then deterministic checks. Then `/code-review` once. No third specialist cycle under another name.
- **`/code-review` runs once per Slice**, after the vertical path exists and deterministic checks are green, before integrate/commit. Not after every specialist hop. Not only on the final PRD PR.
- **A Pipeline Incident** is posted on the Slice Issue (fixed heading `## Pipeline Incident`) when any of these is true: the same FAIL reason on consecutive cycles; a “fix” that only hides the finding; a static/reviewer PASS then Runner or `tsc`/`eslint` FAIL; the retry cap is hit; a sibling file already solved it and the specialist did not look. Same rule for every specialist and gate, not only Component.

## Considered Options

- **One-shot Builder/Scaffold, skip the Reviewer, gate with `/code-review` only** — rejected. `/code-review` does not run `tsc`, eslint, hygiene scripts, or Jest. It is a two-axis diff review, not a reviewer.
- **Keep cap 3** — rejected. #271 hit the cap anyway; the extra cycle was the same lint finding behind another function layer.
- **Delete the TestReviewer agent** (hygiene script + Runner only) — declined for now. A Reviewer PASS then Runner FAIL is a Pipeline Incident so the static gate can be improved without pretending a lower cap makes it see mocks.

## Consequences

- Update `unit-test-delegation-workflow`, the component workflow, `CLAUDE.md`, `AGENTS.md`, `.claude/checklist.md`, and Sandcastle prompt rules from cap 3 to cap 2, and add the Pipeline Incident triggers plus once-per-Slice `/code-review`.
- `/to-issues` still splits `gate:full` when two Gated Pipelines would run; this ADR does not change that cut rule.
