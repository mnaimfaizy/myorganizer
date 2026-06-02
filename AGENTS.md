# MyOrganizer Agent Guide

## Scope

This is an Nx monorepo for a full-stack organizer app: Next.js frontend, Express/Prisma backend, shared TypeScript libraries, and Playwright e2e tests. Nested AGENTS.md files add local rules for apps and libraries.

## Setup

- Use Node >=22 and Corepack-managed Yarn 4.
- Install with `corepack yarn install --immutable`.
- Start local services with `docker-compose up -d`.
- Start apps with `yarn start:backend` and `yarn start:myorganizer`.

## Commands

- Build: `yarn build:backend`, `yarn build:myorganizer`.
- Test one project: `yarn nx test <project-name>`.
- Lint: `yarn nx lint <project-name>` or `yarn lint`.
- Format: `yarn format:write`.
- AI commit workflow: `corepack yarn ai:commit --message-file <path>` (or pipe the message on stdin).
- AI PR workflow: `corepack yarn ai:create-pr [--reviewer <login>]`.
- API sync after backend contract changes: `yarn openapi:sync`; check drift with `yarn openapi:check`.
- Release (cut branch): `yarn release:cut --version vX.Y.Z --push --notes-file RELEASE_NOTES.md`.
- Release (tag after production deploy): `yarn release:tag --version vX.Y.Z --push`.
- Release dry-run (preview only): `yarn release:cut --version vX.Y.Z --dry-run`.
- Prisma (backend): prefer Nx targets `yarn nx run backend:migrate` and `yarn nx run backend:generate-types`.
- Prisma (manual): run from `apps/backend/src` and pass schema path, e.g. `npx prisma migrate dev --schema prisma/schema --name <migration_name>` and `npx prisma generate --schema prisma/schema`.

## Architecture

- Keep `apps/myorganizer/src/app/**` as thin Next.js route wrappers.
- Put page logic in `libs/web/pages/<route>` and shared code in `libs/**`.
- Use path aliases from `tsconfig.base.json`.
- Vault-backed features are end-to-end encrypted; the server stores ciphertext only.
- Treat `libs/app-api-client` and API specs as generated/synced outputs.

## Design Tokens

- The design reference lives in `libs/design-tokens/DESIGN.md`; use it together with `libs/design-tokens/src/tokens.json` when changing colors, typography, spacing, radii, or shadows.
- `libs/design-tokens/src/tokens.json` is the single source of truth for design values; do not hard-code hex colors, font stacks, or magic spacing values in components when a token should exist.
- Regenerate token outputs with `yarn nx run design-tokens:build-tokens` after editing tokens.
- Never edit files under `libs/design-tokens/src/generated/` directly; they are regenerated from `tokens.json`.
- Prefer importing token constants from `@myorganizer/design-tokens` over introducing inline styling literals in application code.

## Do

- Follow existing TypeScript, Tailwind, Jest, and Nx patterns.
- Use React Hook Form + Zod for new forms.
- Use the generated API client when it covers the endpoint.
- Add or update focused tests for changed behavior.
- Keep docs concise and link to existing docs when possible.
- Use the `Commit` sub-agent only to draft Conventional Commit messages; execute commits through the shared AI workflow so Husky is allowed to finish.
- For commit requests, wait for `git commit` to return before continuing. If Husky fails, fix the reported issue and rerun the narrow validation before retrying the commit.
- For PR requests, gather commit history from the current branch, push upstream if needed, create or reuse the PR, assign the authenticated GitHub user, and leave reviewers empty unless the user explicitly names them.
- For issue creation requests, follow `.github/skills/github-issue-creation-workflow/SKILL.md` and delegate to `IssueCreator` so duplicate checks, required details, and label validation are handled consistently.
- For release requests, follow the `.github/skills/release-and-deploy-workflow/SKILL.md` skill. Delegate: pre-flight → `PreflightCheck` agent, version proposal → `VersionBump` agent, notes drafting → `ReleaseNotes` agent.

## Do Not

- Do not introduce `package-lock.json` or `pnpm-lock.yaml` changes.
- Do not put app-local shared helpers under `apps/myorganizer/src/lib/**`.
- Do not store vault plaintext on the server or add plaintext todo APIs.
- Do not hand-edit generated API client code.
- Do not commit secrets or production credentials.
- Do not cancel, background, or abandon a running `git commit` while Husky checks are still executing.
- Do not open pull requests from `main` or another base branch directly.

## Spec-driven changes (OpenSpec)

For non-trivial features and refactors, draft an OpenSpec change before coding.

- Config and project context: [openspec/config.yaml](openspec/config.yaml).
- Changes live under `openspec/changes/<name>/` and are archived on completion.
- Copilot Chat slash commands: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, `/opsx-explore` (see [.github/prompts](.github/prompts)).
- Skills under [.github/skills](.github/skills) (`openspec-*`) auto-load when relevant.
- Skip OpenSpec for trivial fixes (typos, one-line bugs) — open a PR directly.
- OpenSpec describes _what_ to build; existing `.github/skills/*` describe _how_ (vault, backend API, frontend pages, prisma, e2e, auth, youtube, release).
