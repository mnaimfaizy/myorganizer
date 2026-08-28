# Mobile Vault Agent Guide

## Scope

Device vault implementation: crypto, read-only sync, and session context for React Native.

The mobile client does not persist a Local Vault. `VaultProvider` fetches vault meta from the
server, derives the Master Key, and unwraps it in memory; `pullDecryptedBlob` reads one blob at a
time and decrypts on device. There is no storage adapter and no write path. Adding either is a
decision to record, not an implementation detail to fill in — see
[ADR 0047](../../../../docs/adr/0047-vault-access-is-obtained-through-an-owner-bound-handle.md).

## Commands

- Test: `yarn nx test mobile-feat-vault`.
- Lint: `yarn nx lint mobile-feat-vault`.

## Do

- Keep plaintext and the Master Key in device memory while unlocked.
- Reuse `vault-core` types and the same ciphertext blob contract as the web vault.

## Do Not

- Do not send decrypted vault data off the device.
- Do not persist passphrases, recovery keys, or the Master Key in plaintext.
- Do not import browser WebCrypto or `localStorage` helpers from `@myorganizer/web-vault`.
- Do not add local vault persistence without a recorded decision. The web vault's owner-bound
  handle lives in `libs/web-vault` on purpose; do not revive a cross-platform storage interface to
  reach it.
