# Frontend App Agent Guide

## Scope

Next.js app shell for MyOrganizer. Route wrappers live here; page logic lives in libraries.

## Commands

- Serve: `yarn start:web` or `yarn nx dev web` (dev server); `yarn nx start web` builds and serves production. The targets are inferred from `next.config.js` (ADR 0083).
- Test: `yarn nx test web`.
- Lint: `yarn nx lint web`.
- Build: `yarn build:web`.

## Do

- Keep `src/app/**` files thin: routing, metadata, layout composition, and imports from page libraries.
- Use imports like `@myorganiser/web-pages/<route>` for route implementations.
- Keep browser-facing auth aligned with `@myorganiser/auth` and refresh-cookie behavior.

## Do Not

- Do not put feature logic, shared helpers, data fetching, or form logic directly in the app wrapper.
- Do not create `src/lib/**` shared code here; use `libs/**`.
- Do not bypass the generated API client when it already supports the use case.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
