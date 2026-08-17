# Mobile Vault Agent Guide

## Scope

Device vault implementation: crypto, storage, sync, and session context for React Native.

## Commands

- Test: `yarn nx test mobile-feat-vault`.
- Lint: `yarn nx lint mobile-feat-vault`.

## Do

- Keep plaintext and the Master Key in device memory while unlocked.
- Reuse `vault-core` types and the same ciphertext blob contract as the web vault.
- Persist ciphertext with the platform storage adapter, not a web API.

## Do Not

- Do not send decrypted vault data off the device.
- Do not persist passphrases, recovery keys, or the Master Key in plaintext.
- Do not import browser WebCrypto or `localStorage` helpers from `@myorganizer/web-vault`.
