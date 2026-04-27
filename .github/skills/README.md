# Local Skills

This directory holds repo-local skills for MyOrganizer.

Committed first wave:

- `vault-feature-workflow`
- `backend-api-contract-change`
- `frontend-page-library-workflow`
- `release-and-deploy-workflow`

Committed second wave:

- `auth-session-workflow`
- `playwright-e2e-workflow`
- `youtube-integration-workflow`
- `prisma-migration-workflow`

Committed third wave:

- `nx-monorepo-workflow`

These skills capture project-specific workflows that are easy for agents to miss even after reading the general repo instructions.

Note: these are VS Code workspace skills stored in `.github/skills`. They are intended for agent discovery inside the editor. They may not appear in `npx skills list`, which focuses on skills installed through the `skills` CLI.

Third-party skills are not vendored into this repository by default. That keeps the repo lean, avoids freezing copies of external skill packages, and makes it easier to review and update them independently.

See `EXTERNAL_SKILLS.md` for the approved project-scope third-party skill set.
