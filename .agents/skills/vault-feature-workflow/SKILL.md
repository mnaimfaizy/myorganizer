---
name: vault-feature-workflow
description: 'Use when working on vault-backed features, encrypted blob types, vault export/import, ciphertext-only sync, or browser vault flows in MyOrganizer.'
---

# Vault Feature Workflow

## Use This Skill When

- Adding or changing vault-backed features such as addresses, mobile numbers, subscriptions, todos, or vault export/import
- Modifying encrypted blob shapes, vault migrations, or server sync behavior
- Updating vault initialization, unlock, recovery, export, or import flows

## Core Rules

- Plaintext must stay in browser memory only while the vault is unlocked.
- Backend APIs and database storage must remain ciphertext-only.
- Do not add plaintext Prisma models or plaintext REST endpoints for vault-backed data.
- Do not persist master keys, passphrases, or recovery keys in plaintext.

## Workflow

1. Confirm whether the change touches an existing blob type or introduces a new one.
2. Keep route wrappers thin. Put page logic in `libs/web/pages/<route>` and vault logic in `libs/web-vault` or `libs/vault-core`.
3. If a blob type or blob shape changes, update all dependent surfaces together:
   - `libs/web-vault`
   - `libs/vault-core`
   - backend vault allowlists, controllers, and validation
   - vault export/import
   - vault migration logic and tests
4. If a form is involved, use React Hook Form and Zod.
5. If server sync is involved, validate blob shape and size before storage and keep decrypted payloads out of backend requests.
6. Update docs if blob types, recovery flows, or export/import behavior changed.

## Checkpoints

- If any request body now contains plaintext vault data, stop and redesign.
- If you changed a blob type without touching export/import or migration code, the change is incomplete.
- If you added vault-backed UI logic outside `libs/web/pages/*` or `libs/web-vault`, move it to the owning library.

## Validation

- Run the narrowest affected tests first:
  - `yarn nx test web-vault`
  - `yarn nx test <affected-page-lib>`
  - `yarn nx test backend`
- Run targeted lint for changed projects:
  - `yarn nx lint web-vault`
  - `yarn nx lint <affected-project>`

## Key References

- `README.md`
- `.github/copilot-instructions.md`
- `libs/web-vault/AGENTS.md`
- `libs/web/pages/AGENTS.md`
- `docs/internal/e2ee-vault-plan.md`
- `docs/internal/vault-export-import-ui.md`
- `docs/internal/address-mobile-usage-plan.md`
