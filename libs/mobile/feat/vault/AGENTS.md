# Mobile Vault Agent Guide

## Scope

Device vault implementation: crypto, read and write sync, and session context for React Native.

The mobile client does not persist a Local Vault. `VaultProvider` fetches vault meta from the
server, derives the Master Key, and unwraps it in memory; `readVaultBlob` reads one blob at a time
and decrypts on device. `pushVaultBlob` is the mobile Vault Push: read-modify-write against the
server under `If-Match`, merging a newer server copy by the pinned strategy in `vault-core` and
refusing a `promptOnConflict` type — see
[ADR 0107](../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md).
Screens edit through `useVaultBlob`, which reverts a failed push and never holds the edit anywhere
else. There is still no storage adapter; adding one is a decision to record, not an implementation
detail to fill in — see
[ADR 0047](../../../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md).

`crypto.ts` has a `crypto.web.ts` platform variant. Metro never selects it, so iOS and Android
always get the native react-native-quick-crypto path; only the `mobile:build` Vite target picks it
up, via the `.web.ts`-before-`.ts` ordering in `apps/mobile/vite.config.mts`. It exists because
quick-crypto reaches react-native-nitro-modules and react-native-quick-base64, which deep-import
`react-native/Libraries/*` and `TurboModuleRegistry` — neither of which react-native-web ships, so
the web bundle cannot resolve them. The two paths are wire-compatible: WebCrypto's AES-GCM output
is already `ciphertext || 16-byte authTag`, the same layout the native path assembles by hand.
Change one and you must change the other.

## Commands

- Test: none yet — this project has no Jest target, and the mobile test toolchain is unresolved
  (`TECH_STACK.md`). The pure merge and edit helpers it calls are tested in `vault-core`.
- Lint: `yarn nx lint mobile-feat-vault`.

## Do

- Keep plaintext and the Master Key in device memory while unlocked.
- Reuse `vault-core` types and the same ciphertext blob contract as the web vault.
- Decide convergence only in `pushVaultBlob`, from `VAULT_BLOB_CONVERGE_STRATEGIES`. Express an edit
  as a function of the envelope (`putVaultRecord`, `deleteVaultRecord`) so a retry and a merge can
  re-apply it; a delete must write the Deletion Log, not just drop the record.

## Do Not

- Do not send decrypted vault data off the device.
- Do not persist passphrases, recovery keys, or the Master Key in plaintext.
- Do not import browser WebCrypto or `localStorage` helpers from `@myorganizer/web-vault`. The
  WebCrypto in `crypto.web.ts` is a platform variant of this lib's own module, not a reach into the
  web vault, and it is the only place in this lib where WebCrypto is allowed.
- Do not add local vault persistence without a recorded decision. The web vault's owner-bound
  handle lives in `libs/web/vault` on purpose; do not revive a cross-platform storage interface to
  reach it.
