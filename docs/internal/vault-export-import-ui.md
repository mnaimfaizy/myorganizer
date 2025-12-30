# Vault export/import UI (ciphertext bundle)

## Context
- Tracks: https://github.com/mnaimfaizy/myorganizer/issues/28
- Goal: allow users to export/import a ciphertext-only vault bundle as JSON without ever handling plaintext server-side.

## Planned scope
- Export: generate ciphertext bundle + metadata and trigger download (JSON).
- Import: validate version/shape/size, then load bundle and attempt decrypt with passphrase or recovery key.
- Error UX: graceful handling for invalid, corrupt, or oversized bundles.
- Server integration: prefer real `/vault/export` and `/vault/import` endpoints; fallback to local-only flows when offline or when endpoints unavailable.

## UI/UX outline
- Entry point in vault area (e.g., settings or actions menu) for export/import.
- Export flow: confirm modal, then download JSON file; remind user the file is ciphertext and should be stored safely.
- Import flow: file picker, validate structure, show summary of metadata (no plaintext), ask for passphrase or recovery key to decrypt, report success/failure.
- Warnings: call out that deleting the recovery key or losing passphrase makes bundle unusable.

## Validation notes
- Ensure bundle contains only ciphertext + metadata (no plaintext addresses/phones).
- Reject files that are malformed, version-mismatched, or exceed safe size limits.

## Open questions / TODO
- Final UI location and copy.
- Exact bundle schema to validate against (mirror backend contract?).
- Whether to allow drag/drop in addition to file picker.
- Size limits and user messaging.

## Next steps
- Design UI wireframes for export/import entry points and flows.
- Align client-side bundle schema with backend contract and add validation helpers.
- Implement API calls or local fallback, plus optimistic error handling.
- Add tests (unit + e2e) for export/import happy-path and failure cases.
