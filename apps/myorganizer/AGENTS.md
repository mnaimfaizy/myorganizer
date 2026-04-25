# Frontend App Agent Guide

## Scope

Next.js app shell for MyOrganizer. Route wrappers live here; page logic lives in libraries.

## Commands

- Serve: `yarn start:myorganizer` or `yarn nx serve myorganizer`.
- Test: `yarn nx test myorganizer`.
- Lint: `yarn nx lint myorganizer`.
- Build: `yarn build:myorganizer`.

## Do

- Keep `src/app/**` files thin: routing, metadata, layout composition, and imports from page libraries.
- Use imports like `@myorganizer/web-pages/<route>` for route implementations.
- Keep browser-facing auth aligned with `@myorganizer/auth` and refresh-cookie behavior.

## Do Not

- Do not put feature logic, shared helpers, data fetching, or form logic directly in the app wrapper.
- Do not create `src/lib/**` shared code here; use `libs/**`.
- Do not bypass the generated API client when it already supports the use case.
