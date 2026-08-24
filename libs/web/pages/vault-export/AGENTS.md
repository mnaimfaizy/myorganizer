# Vault Export Page Agent Guide

## Scope

Dashboard vault export/import page for ciphertext bundles (`/dashboard/vault-export`). The
export/import cards themselves live in `@myorganizer/web-pages/vault`; this library re-exports
them rather than holding a second copy.

## Do

- Export and import ciphertext plus metadata only.
- Validate bundle version, shape, and size before persistence.
- Use the normal vault unlock flow after import.

## Do Not

- Do not display, log, or upload decrypted vault contents.
