# Web Vault UI Agent Guide

## Scope

React UI, session provider, vault gate, reconcile runner, and pull runner for the web vault.

## Commands

- Test: `yarn nx test web-vault-ui`.
- Lint: `yarn nx lint web-vault-ui`.

## Do

- Keep vault unlock/session state explicit and local to the client.
- Give the session provider's handle its sync sink there and nowhere else. `VaultSessionProvider` owns the one Vault Sync Queue per User; a page that wants its edit synchronised needs to do nothing, and a page that adds its own push has added a second one.
- Reuse `@myorganizer/web-ui` primitives for UI.
- Preserve reconcile flow safety and user recovery paths.

## Do Not

- Do not expose secrets or plaintext in logs, URLs, or server requests.
- Do not duplicate low-level vault logic from `web-vault` or `vault-core`.
