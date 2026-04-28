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
- API sync after backend contract changes: `yarn openapi:sync`; check drift with `yarn openapi:check`.
- Prisma (backend): prefer Nx targets `yarn nx run backend:migrate` and `yarn nx run backend:generate-types`.
- Prisma (manual): run from `apps/backend/src` and pass schema path, e.g. `npx prisma migrate dev --schema prisma/schema --name <migration_name>` and `npx prisma generate --schema prisma/schema`.

## Architecture

- Keep `apps/myorganizer/src/app/**` as thin Next.js route wrappers.
- Put page logic in `libs/web/pages/<route>` and shared code in `libs/**`.
- Use path aliases from `tsconfig.base.json`.
- Vault-backed features are end-to-end encrypted; the server stores ciphertext only.
- Treat `libs/app-api-client` and API specs as generated/synced outputs.

## Do

- Follow existing TypeScript, Tailwind, Jest, and Nx patterns.
- Use React Hook Form + Zod for new forms.
- Use the generated API client when it covers the endpoint.
- Add or update focused tests for changed behavior.
- Keep docs concise and link to existing docs when possible.

## Do Not

- Do not introduce `package-lock.json` or `pnpm-lock.yaml` changes.
- Do not put app-local shared helpers under `apps/myorganizer/src/lib/**`.
- Do not store vault plaintext on the server or add plaintext todo APIs.
- Do not hand-edit generated API client code.
- Do not commit secrets or production credentials.

## Spec-driven changes (OpenSpec)

For non-trivial features and refactors, draft an OpenSpec change before coding.

- Config and project context: [openspec/config.yaml](openspec/config.yaml).
- Changes live under `openspec/changes/<name>/` and are archived on completion.
- Copilot Chat slash commands: `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, `/opsx-explore` (see [.github/prompts](.github/prompts)).
- Skills under [.github/skills](.github/skills) (`openspec-*`) auto-load when relevant.
- Skip OpenSpec for trivial fixes (typos, one-line bugs) — open a PR directly.
- OpenSpec describes _what_ to build; existing `.github/skills/*` describe _how_ (vault, backend API, frontend pages, prisma, e2e, auth, youtube, release).
