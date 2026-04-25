# Web Page Libraries Agent Guide

## Scope

One Nx React library per frontend route/page, imported by thin wrappers in `apps/myorganizer/src/app/**`.

## Commands

- Test one page library: `yarn nx test web-pages-<route>`.
- Lint one page library: `yarn nx lint web-pages-<route>`.

## Do

- Keep page components, data loading, form logic, schemas, and page helpers in the route library.
- Use `@myorganizer/web-ui`, `@myorganizer/auth`, `@myorganizer/web-vault`, and the generated API client as appropriate.
- Keep vault-backed pages ciphertext-only outside the browser.

## Do Not

- Do not move page logic back into the Next app wrapper.
- Do not duplicate shared UI or vault primitives inside a page library.
