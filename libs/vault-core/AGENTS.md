# Vault Core Agent Guide

## Scope

Platform-agnostic vault types and interfaces for encrypted user data, plus the
one Web Crypto suite the web app and the standalone Escape Copy reader both
run.

## Commands

- Test: `yarn nx test vault-core`.
- Lint: `yarn nx lint vault-core`.

## Do

- Keep this library free of React, Next.js, React Native, and backend framework APIs.
- Version vault wire formats and migration-facing types carefully.

## Do Not

- Do not add platform-specific storage implementations here.
- Do not weaken ciphertext-only assumptions.

## The one crypto exception, and its edges

`vaultCrypto.ts` holds real PBKDF2 and AES-GCM over the standard Web Crypto API
and the standard `btoa` / `atob` / `TextEncoder` globals. It is here on purpose
and it is the only such module.

It moved here from `web-vault` because a third caller appeared that is neither
web nor mobile: the standalone Escape Copy reader, which
[ADR 0064](../../docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)
requires to be bundled from the app's own crypto rather than written a second
time. A reader carrying its own PBKDF2 would be a second implementation of the
one thing that must never disagree with the first, and it would disagree
silently — discovered at the only moment anybody runs it. `web-vault`'s
`vault/crypto.ts` is now a re-export, so nothing on the web side changed.

Two edges hold the old rule where it still applies:

- **This is Web Crypto, not a browser API.** Node 22 and every browser the app
  supports provide all of it, which is what lets the reader be a single file
  with no dependency to fetch. `tools/testing/web-crypto-test-setup.ts` installs
  Node's own under Jest, which does not reliably expose them.
- **React Native does not have it, and must not import it.** Mobile runs
  `react-native-quick-crypto` and reaches the `VaultCrypto` interface in
  `interfaces.ts` instead — that interface exists for exactly this reason, and
  it is deliberately typed in `unknown` rather than `CryptoKey` so a mobile
  caller cannot drift into the web implementation by accident.
  `cryptoCompatibility.test.ts` beside `vaultCrypto.ts` is what holds the two
  byte-for-byte ([ADR 0039](../../docs/adr/0039-web-and-mobile-vaults-share-one-crypto-suite.md)).

A second crypto implementation in this library is not an extension of this
exception. It is the thing the exception exists to avoid.
