# Web and mobile vaults share one crypto suite: PBKDF2-SHA256 and AES-GCM

The January 2026 vault planning drafts (`docs/internal/e2ee-vault-plan.md`, `docs/internal/mobile-app-spike.md`) treated the shipped WebCrypto stack as a prototype and named Argon2id + XChaCha20-Poly1305 via libsodium as the "recommended for production / cross-platform parity" target, on the grounds that libsodium primitives are easier to keep identical across iOS, Android, and web, and that XChaCha20's nonce handling is less error-prone than AES-GCM's. That target was never adopted. When `libs/mobile/feat/vault` was built it matched the web stack instead, and `libs/vault-core/src/lib/cryptoCompatibility.test.ts` was written to hold the two platforms together. Those drafts have since been deleted (recoverable from git history); this ADR records the decision the code already made, which would otherwise survive only as an assertion inside a test file.

## Decision

Both platforms derive the vault key with **PBKDF2-SHA256 at 310,000 iterations** to a **32-byte key**, and encrypt with **AES-GCM-256** using a **16-byte salt** and a **12-byte IV**. Web uses WebCrypto (`libs/web-vault/src/lib/vault/crypto.ts`); mobile uses `react-native-quick-crypto` with the same parameters (`libs/mobile/feat/vault/src/constants.ts`). The parameters are not per-platform tunables: `libs/vault-core/src/lib/cryptoCompatibility.test.ts` asserts each one and is the gate that keeps a vault written on one platform readable on the other.

Changing a KDF or AEAD parameter is a wire-format change, not an implementation detail. It requires a versioned migration path for vaults already in the field and a superseding ADR — the server stores ciphertext only and cannot re-encrypt on the user's behalf.

## Considered Options

- **Argon2id + XChaCha20-Poly1305 via libsodium, migrating existing vaults** — the drafts' recommendation, rejected. The parity argument it rested on assumed web would keep WebCrypto while mobile went libsodium, which is the split it claimed to prevent; closing it needed a WASM libsodium build on web and a maintained React Native sodium binding, against a WebCrypto/`react-native-quick-crypto` pair that already agreed. The migration was the deciding cost: re-deriving and re-encrypting every blob under a new suite, for users who own the only copy of the key, to buy misuse resistance against a nonce bug that a shared 12-byte random IV path and a compatibility test already close.
- **Let each platform pick its own suite behind a versioned envelope** — rejected. The envelope already carries `kdf_name`, so this is expressible, but it turns every export/import and cloud-sync path into a cross-suite matrix and gives the compatibility test nothing to assert.
- **Raise PBKDF2 iterations on mobile only, for device performance** — rejected for the same reason: a vault must unlock identically wherever the user opens it.

## Consequences

- `cryptoCompatibility.test.ts` failing is a release blocker, not a flaky test. It is the only automated check that a vault stays portable across platforms.
- New platforms (a desktop client, a CLI) adopt this suite rather than choosing their own, and extend the compatibility test to cover themselves.
- Argon2id is not off the table forever. Revisiting it means a vault format version bump and a migration that runs client-side while the user is unlocked, not a swap of the primitives in place.
