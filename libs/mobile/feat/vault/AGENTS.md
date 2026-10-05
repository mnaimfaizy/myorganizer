# Mobile Vault Agent Guide

## Scope

Device vault implementation: crypto, read and write sync, and session context for React Native.

The mobile client does not persist a Local Vault. `VaultProvider` fetches vault meta from the
server, derives the Master Key, and unwraps it in memory; `readVaultBlob` reads one blob at a time
and decrypts on device. `pushVaultBlob` is the mobile Vault Push: read-modify-write against the
server under `If-Match`, merging a newer server copy by the pinned strategy in `vault-core` and
refusing a `promptOnConflict` type — see
[ADR 0107](../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md).
`pullVaultBlob` is the mobile Vault Pull: it reads the server's copy and merges an edit whose push
failed into it by the same strategy, so a reload does not drop that edit — see
[ADR 0121](../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md).
Screens edit through `useVaultBlob`, which reverts a failed push and holds that edit in memory
only: a retry or a reload sends it, `discard` drops it, and it is never persisted. What that hook
decides lives in `createVaultBlobController`, and what a screen decides from a reload's outcome in
`pendingVaultEdit.ts` — plain modules with no React import, so they are tested in this lib's node
Jest project; put new hook logic there, not in the hook. There is still no storage adapter; adding
one is a decision to record, not an implementation detail to fill in — see
[ADR 0047](../../../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md).

`crypto.ts` has a `crypto.web.ts` platform variant. Metro never selects it, so iOS and Android
always get the native react-native-quick-crypto path; only the `mobile:build` Vite target picks it
up, via the `.web.ts`-before-`.ts` ordering in `apps/mobile/vite.config.mts`. It exists because
quick-crypto reaches react-native-nitro-modules and react-native-quick-base64, which deep-import
`react-native/Libraries/*` and `TurboModuleRegistry` — neither of which react-native-web ships, so
the web bundle cannot resolve them. The two paths are wire-compatible: WebCrypto's AES-GCM output
is already `ciphertext || 16-byte authTag`, the same layout the native path assembles by hand.
Change one and you must change the other.

`bytes.ts` has a `bytes.web.ts` variant for the same reason: its Buffer shim requires
react-native-quick-base64 on React Native. `crypto.web.ts` re-exports the byte helpers from `./bytes`
as `crypto.ts` does, so the web target has one copy of them.

## Commands

- Test: `yarn nx test mobile-feat-vault` (or the direct Jest invocation in the harness's own
  instructions). Runs in a plain Node environment, not React Native — it covers `unlock.ts`, which
  is deliberately split from `crypto.ts` so it carries no `react-native-quick-crypto` import. Most
  merge and edit helpers this lib calls are still tested in `vault-core`.
- Lint: `yarn nx lint mobile-feat-vault`.

## Do

- Keep plaintext and the Master Key in device memory while unlocked.
- Reuse `vault-core` types and the same ciphertext blob contract as the web vault.
- Decide convergence only in `sync.ts`'s `converge`, which `pushVaultBlob` and `pullVaultBlob` both
  call, from `VAULT_BLOB_CONVERGE_STRATEGIES`. Express an edit
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
