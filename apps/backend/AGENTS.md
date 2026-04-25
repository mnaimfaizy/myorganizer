# Backend Agent Guide

## Scope

Express REST API with TypeScript, TSOA, Prisma, Passport, JWT auth, email, vault, and YouTube integration code.

## Commands

- Serve: `yarn start:backend` or `yarn nx serve backend`.
- Test: `yarn nx test backend`.
- Lint: `yarn nx lint backend`.
- Build: `yarn build:backend`.
- Prisma: run from `apps/backend/src` with `npx prisma ...` or use Nx targets `backend:generate-types` and `backend:migrate`.

## Do

- Use TSOA controllers, service classes, Prisma, and Zod/class-validator-style boundary validation.
- Run `yarn openapi:sync` after endpoint or DTO changes.
- Keep auth cookies, JWT refresh flow, CORS credentials, and rate limits aligned with docs.
- Store vault blobs and exports as ciphertext plus metadata only.

## Do Not

- Do not expose internal errors or secrets in responses.
- Do not construct raw SQL with string concatenation.
- Do not add plaintext storage for vault-backed data.
- Do not edit Prisma migrations manually.
