# To Issues Command

Use this workflow when a PRD Issue exists and needs to be broken into Slice Issues for autonomous agents.

1. Ask the user for the PRD Issue number if not already provided.
2. Read and follow `.github/skills/to-issues/SKILL.md` exactly.
3. Run `yarn ai:create-labels` first if any required labels are missing from the repo.
4. After all slices are published, remind the user to run `yarn dispatch-agents --prd <issue-number>` to hand off to autonomous agents.
