# Web Vault UI Agent Guide

## Scope

React UI, session provider, vault gate, and migration runner for the web vault.

## Commands

- Test: `yarn nx test web-vault-ui`.
- Lint: `yarn nx lint web-vault-ui`.

## Do

- Keep vault unlock/session state explicit and local to the client.
- Reuse `@myorganizer/web-ui` primitives for UI.
- Preserve migration flow safety and user recovery paths.

## Do Not

- Do not expose secrets or plaintext in logs, URLs, or server requests.
- Do not duplicate low-level vault logic from `web-vault` or `vault-core`.
