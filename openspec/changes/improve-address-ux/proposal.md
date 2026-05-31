## Why

The current address frontend is too manual: users type every field without meaningful validation feedback, duplicate review, or a guided path from address creation to usage tracking. Improving this flow now makes the vault-backed address module more trustworthy without changing the ciphertext-only storage model.

## What Changes

- Replace the always-visible add-address card with an accessible drawer flow that keeps the address list visible and guides users through entry, duplicate review, preview, and save actions.
- Add reusable address form validation, inline field messages, account-country defaults, and browser-only duplicate detection with an explicit save-anyway override.
- Improve the address list experience with clearer empty state, counts, filtering/search, visible actions, and better current/old and usage-location status cues.
- Tighten usage-location form validation for optional URLs and duplicate organisation names within an address.
- Add focused unit and e2e coverage for validation, duplicate warning behavior, and the drawer-based encrypted address flow.

## Capabilities

### New Capabilities

- `address-management-ux`: Private-first guided address creation, duplicate review, address list filtering/status display, and usage-location validation for vault-backed address records.

### Modified Capabilities

- None.

## Non-goals

- No external address autocomplete provider in this change.
- No plaintext address REST endpoints, Prisma address model, or server-side address validation.
- No change to the encrypted `addresses` vault blob shape or export/import schema version.
- No auth flow or generated API client changes.

## Impact

- Frontend page library: `libs/web/pages/addresses`.
- Shared UI: export the existing `Sheet` primitive from `@myorganizer/web-ui`.
- Core reuse: consume existing country/account settings helpers for default country selection.
- Vault/E2EE: plaintext stays browser-only; `loadDecryptedData`, `normalizeAddresses`, and `saveEncryptedData` remain the persistence path.
- Tests: Jest coverage in the address page library plus focused Playwright updates for encrypted address CRUD.
