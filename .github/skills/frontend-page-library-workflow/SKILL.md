---
name: frontend-page-library-workflow
description: "Use when adding or changing frontend pages, dashboard flows, forms, or route implementations in MyOrganizer's Next.js app and page libraries."
---

# Frontend Page Library Workflow

## Use This Skill When

- Adding a new frontend page or dashboard route
- Changing page logic, form handling, or data fetching for an existing route
- Refactoring logic between `apps/myorganizer` wrappers and `libs/web/pages/*`

## Core Rules

- Keep `apps/myorganizer/src/app/**` files thin. They should handle routing, metadata, and composition only.
- Put page logic, schemas, forms, and helpers in `libs/web/pages/<route>`.
- Prefer the generated API client when it already supports the backend endpoint.
- For new forms, use React Hook Form and Zod.

## Workflow

1. Decide whether the change belongs in a route wrapper, a page library, or a shared library.
2. Keep app wrappers thin and move feature logic into the owning page library.
3. Use shared libraries first:
   - `@myorganizer/web-ui`
   - `@myorganizer/auth`
   - `@myorganizer/web-vault`
   - `@myorganizer/app-api-client`
4. If the UI only needs a small part of a generated response, prefer a narrow local type over coupling to unstable generated aliases.
5. If the route is vault-backed, keep sensitive plaintext in browser memory only and reuse the vault libraries instead of reimplementing crypto or sync logic.
6. Add focused tests and e2e coverage when the user-facing flow changes meaningfully.

## Checkpoints

- If business logic or shared helpers ended up under `apps/myorganizer/src/app/**`, move them out.
- If the code bypasses the generated client without a good reason, reconsider.
- If a shared helper is being added under the app instead of `libs/**`, move it.

## Validation

- Run the narrowest checks first:
  - `yarn nx test <affected-page-lib>`
  - `yarn nx lint <affected-project>`
- If the user flow changed materially, run focused Playwright coverage:
  - `yarn nx e2e myorganizer-e2e --ui`

## Key References

- `README.md`
- `AGENTS.md`
- `apps/myorganizer/AGENTS.md`
- `libs/web/pages/AGENTS.md`
- `libs/app-api-client/AGENTS.md`
- `apps/myorganizer-e2e/AGENTS.md`
