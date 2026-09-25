# Vault Core Agent Guide

## Scope

The Vault on both sides of encryption, platform-agnostic:

- **Ciphertext side** — Vault Blob types and interfaces, the export envelope,
  migration, and the one Web Crypto suite the web app and the standalone Escape
  Copy reader both run.
- **Plaintext side** (`src/lib/records/`) — the record shapes a Vault Blob holds
  once decrypted (Tasks, groceries, contacts, subscriptions, and the currency
  codes a record may carry), the Vault Blob Envelope with its Tombstones, and
  the per-record merge a Vault Pull converges with. It is pure: no crypto, no
  storage, no clock, no browser global, so it is exported from the Portable
  Entry Point as well as the main one. It only ever runs on a client holding
  the Master Key.

It moved here from `libs/core` (#164) so the merge is reachable from mobile and
is reviewed with the rest of the Vault.

## Commands

- Test: `yarn nx test vault-core`.
- Lint: `yarn nx lint vault-core`.

## Do

- Keep this library free of React, Next.js, React Native, and backend framework APIs.
- Version vault wire formats and migration-facing types carefully.

## Do Not

- Do not add platform-specific storage implementations here.
- Do not weaken ciphertext-only assumptions.
- Do not call the per-record merge or read record shapes from server code. The
  backend imports this library for Vault Blob types and handles every Vault Blob
  as opaque Ciphertext; it holds no Master Key, so a plaintext record never
  exists there. The records reach the backend's dependency graph only because
  they share this library — that is documented, not gated, because a type
  import cannot be told apart statically from passing an opaque blob.

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

Mobile imports that interface through the Portable Entry Point `src/portable.ts`
(`@myorganizer/vault-core/portable`), never the main barrel, which carries
`vaultCrypto.ts` and the Escape Copy reader. Keep `portable.ts` free of Web Crypto
and browser globals ([ADR 0103](../../docs/adr/0103-mobile-native-code-is-typechecked-without-dom-and-reaches-shared-libraries-through-a-portable-entry-point.md)).

A second crypto implementation in this library is not an extension of this
exception. It is the thing the exception exists to avoid.
