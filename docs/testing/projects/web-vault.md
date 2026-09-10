# Testing `libs/web-vault`

Jest unit/integration · `babel-jest` + `jsdom` env (React) · `yarn nx test web-vault`

## Config summary

Same transform as [`libs/web-ui`](./web-ui.md) — babel-jest + `@nx/react/babel` + jsdom.

`libs/web-vault-ui` has its own guide: [`web-vault-ui.md`](./web-vault-ui.md). It picks its
crypto seam from the subject of the test, not from the table below.

## Rules

- Do **not** expose plaintext vault data outside of the tested unit.
- For import/export flows, stub the `FileReader` / `Blob` API via jsdom or a manual mock.
- A Vault Claim copies the Unclaimed Local Vault; it does not move it. An owned
  record beside an unsuffixed copy of the same wrapping is
  `skipped-already-owned`, not `replace-offer`. The existing different-vault
  replace-offer case uses a second `initialize`. Do not write a test that
  expects replace-offer for that leftover.

## Crypto

This library drives `@myorganizer/vault-core` through the vault handle; it does not reimplement
crypto. Pick the seam from **what the test claims**, not from the file it sits in.

| The test claims                                                                       | Crypto                                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Ciphertext survives a claim, a converge, or a handle reload and decrypts after unlock | Real WebCrypto through the real handle                      |
| A recovery key unwraps the Master Key and binds it to the claiming handle             | Real WebCrypto through the real handle                      |
| A decision over meta, Sync Bookmarks, ETags, revisions, or blob shape                 | None — hand-build ciphertext-shaped fixtures                |
| Transport, storage, queueing, or scheduling behaviour                                 | None — stub the collaborator (`./serverVaultSync`, the API) |

The handle / claim / converge suites are the carve-out, and the exception is load-bearing rather
than a shortcut nobody got round to closing. Their whole claim is that a blob written under one
wrapping is still the same plaintext after a Vault Claim, a deferred converge, or a reload — and
mocked primitives cannot establish that. Under a mocked `unwrap`, "the payload is still intact"
asserts that a stub returned what a stub was told to return. `vaultClaimedVaultConverge.test.ts`
is the worked example (issue #615): it initializes, claims by passphrase and by recovery key,
reloads a fresh locked handle, and decrypts.

So: do **not** mock a vault-core primitive to make one of those suites faster or simpler. Real
PBKDF2 on every `initialize` / `unlockWithPassphrase` is the cost of the claim, not a smell.

Everything else in this library decides over shapes, not over plaintext, and needs no crypto at
all — that is the common case, and reaching for the real handle there buys nothing but runtime.
Mocking the vault-core primitives themselves is a third thing, and no suite here does it: a test
that would need such a mock is either in the carve-out (use the real handle) or does not need
crypto in the first place (use fixtures).

jsdom has no `crypto.subtle`. It is installed once from Node's `crypto.webcrypto`, along with
`TextEncoder` / `TextDecoder`, in `libs/web-vault/src/test-setup.ts` — which `jest.config.ts` runs
through `setupFilesAfterEnv`, before any test module loads. Suites that drive the real handle need
no polyfill block of their own; do not add one back.

Keep fixture passphrases to 10–15 characters — see
[Credentials in test fixtures](../README.md#credentials-in-test-fixtures).

## Commands

```bash
yarn nx test web-vault
yarn nx lint web-vault
```
