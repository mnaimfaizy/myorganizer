# Web Vault UI Agent Guide

## Scope

React UI, session provider, vault gate, reconcile runner, meta converge runner, and pull runner for the web vault.

## Commands

- Test: `yarn nx test web-vault-ui`.
- Lint: `yarn nx lint web-vault-ui`.

## Do

- Keep vault unlock/session state explicit and local to the client.
- Give the session provider's handle its sync sink there and nowhere else. `VaultSessionProvider` owns the one Vault Sync Queue per User; a page that wants its edit synchronised needs to do nothing, and a page that adds its own push has added a second one.
- Reuse `@myorganizer/web-ui` primitives for UI.
- Preserve reconcile flow safety and user recovery paths.
- Trigger the reconcile runner on mount and on a Local Vault Revision, never on window focus, and never without the watermark. The revision is the signal for "what a reader holds is no longer what is stored", so it covers a removal, an import and a convergence-replacement together; the pass writes through `saveVault`, so it moves that same revision, and a runner that does not record the revision it settled at re-runs on the bump it just caused ([ADR 0066](../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md)).
- Keep the meta converge runner beside the reconcile runner, never inside it. Vault Meta converges on its own terms and cannot gate Vault Blob merging, so the two prompts are separate questions with separate answers, and each must be answerable without answering the other ([ADR 0057](../../docs/adr/0057-vault-meta-converges-separately-and-never-silently.md)).
- Trigger the meta converge runner on mount and on window focus, never on a Local Vault Revision — the reconcile runner's trigger, above, for a different event. A wrapping changed on another device is a remote event with no local signal, so it takes the trigger `VaultPullRunner` already uses ([ADR 0066](../../docs/adr/0066-a-convergence-pass-runs-freely-and-only-the-question-is-suppressed.md), decision point 2). Nothing about reaching the server is ever suppressed; only the dialog is, and only by a Vault Meta Refusal keyed to the wrapping asked about, never by a flag recording that asking happened.
- Word the meta prompt about the passphrase, never about the Vault as a whole. A User cannot act on "your vault differs"; they can act on "your passphrase was changed on another device". Copy that varies by which wrapping moved comes from the pinned `Record<VaultMetaChange, …>` table and from nowhere else.

## Do Not

- Do not expose secrets or plaintext in logs, URLs, or server requests.
- Do not duplicate low-level vault logic from `web-vault` or `vault-core`.
