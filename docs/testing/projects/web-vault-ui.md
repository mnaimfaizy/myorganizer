# Testing `libs/web-vault-ui`

Jest unit/integration · `babel-jest` + `jsdom` env (React) · `yarn nx test web-vault-ui`

## Config summary

Same transform as [`libs/web-ui`](./web-ui.md) — babel-jest + `@nx/react/babel` + jsdom.
Read `libs/web-vault-ui/jest.config.ts` before writing.

This library owns the vault gate, the session provider, and the reconcile / meta-converge /
pull runners. Crypto lives in `@myorganizer/vault-core` via `@myorganizer/web-vault`; this
library does not reimplement it.

## Crypto and the vault handle

[`web-vault`](./web-vault.md) picks its crypto seam from what a test claims about ciphertext.
That table does **not** extend here; this library's seam follows the subject of the test:

| Subject                                                     | Drive                                                 | Stub                                                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The gate's own create / unlock / recovery-key state machine | Real `VaultSessionProvider` and the real vault handle | Network evidence only (`checkVaultAbsentEvidence`)                                                                       |
| A UI branch given a session                                 | —                                                     | `useOptionalVaultSession` (put `claimEvidence` / `absentEvidence` on the session object; the gate reads them from there) |
| The session provider's wiring                               | Real `VaultSessionProvider`                           | `createVaultHandle` / `createVaultSyncQueue`                                                                             |
| A runner (reconcile, meta-converge, pull)                   | —                                                     | `@myorganizer/web-vault` collaborators                                                                                   |

A test whose subject is the gate itself must drive the real handle. Stubbed doubles hide the
state-machine bugs this library exists to catch — `vaultGate.create.spec.tsx` is the worked
example (issue #667). Do not mock `initialize` or unwrap there.

jsdom has no `crypto.subtle`. Suites that drive the real handle polyfill it from Node's
`crypto.webcrypto`, and polyfill `TextEncoder` / `TextDecoder` when initialize needs them.

**Timeouts.** Real PBKDF2 on create/unlock routinely needs 10–15 second `waitFor` / test
timeouts. That cost is expected, not a smell, and is why most suites still stub the handle.
Do not mock crypto in a gate-create suite to make it fast: the suite exists because the
stubbed path missed the bug.

Keep fixture passphrases to 10–15 characters — see
[Credentials in test fixtures](../README.md#credentials-in-test-fixtures).

## Session and plaintext

- Do **not** expose plaintext vault data outside of the tested unit.
- Ask Vault Claim Evidence and Vault Absent Evidence from `VaultSessionProvider` in production
  code. Tests that render the real provider mock the network check, not the session hooks.

Claim / replace-offer outcomes are defined in [`web-vault.md`](./web-vault.md); do not write a
web-vault-ui test that expects a different meaning for those outcomes.

## Commands

```bash
yarn nx test web-vault-ui
yarn nx lint web-vault-ui
```
