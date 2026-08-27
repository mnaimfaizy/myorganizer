# Vault architecture pages

Two self-contained pages describing how the vault actually works. Open either in a browser — no
build step, no network, no server.

| Page                                       | Answers                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [trust-boundary.html](trust-boundary.html) | **Where the line is.** Which zone holds keys, which hold only ciphertext, and what crosses     |
| [lifecycle.html](lifecycle.html)           | **What happens over time.** Seven scenes from creating a vault to restoring it on a new device |

Start with the lifecycle if you are new to the vault; it ends by pointing at the boundary map,
which is the reference you come back to.

## Why they exist

The security properties are documented correctly in prose, but they are spread across
`libs/vault-core`, `libs/web-vault`, `libs/mobile/feat/vault`, a Prisma schema, and a feature
doc. Nobody holds them all at once. The failure these pages prevent is concrete: someone adds a
convenient endpoint, or logs an object while debugging, and moves plaintext or a key across a
line they could not see.

The boundary map carries a reading test for exactly that — if a change adds an arrow leaving the
device, it may carry ciphertext, KDF parameters, or backup metadata, and nothing else.

## Keeping them honest

Both pages embed a JSON manifest of the constants they assert. `yarn vault:pages:check` diffs
those manifests against the constants in source and fails when they diverge:

```bash
yarn vault:pages:check
```

Treat a failure as "the diagram is stale", not "the check is broken". It covers 31 assertions —
KDF parameters, cipher byte lengths, the envelope schema version, all seven size caps across the
three layers that enforce them, the six blob types, the nine import error codes, and both Local
Vault storage keys.

Blob types and error codes are compared as sets rather than sequences, so a page may order them
by the sequence a reader meets them.

The two Local Vault keys are asserted as a pair, and `localVaultKeys.ownerScoped` is compared
against the composition read out of `localVaultStorageKey()` rather than against a pinned string.
A page may not name one key without the other. Both rules exist because the retired `storageKey`
field stayed byte-identical while its meaning changed, and the check went on passing against a page
that sent readers to the wrong slot — see [ADR 0051](../adr/0051-a-pinned-value-does-not-notice-that-its-meaning-moved.md).

Values the pages show that are **not** yet assertable are listed in each manifest under
`notYetExported` — currently the KDF and cipher figures, which are module-private constants. To
bring them under the check, export them and add them to `SOURCES` in
`tools/scripts/check-vault-pages.mjs`.

## Rebuilding

The pages are generated from dc-runtime design exports:

```bash
node tools/scripts/build-agent-map.mjs "<export-dir>" "Vault Trust Boundary.dc.html" docs/vault/trust-boundary.html
```

The builder inlines the design-system stylesheet, embeds both typefaces as woff2 data URIs, and
decides how much runtime to include from the page itself — `lifecycle.html` binds templates so it
carries React, `trust-boundary.html` does not and ships as plain DOM at roughly a third the size.

Both are in `.prettierignore`, so rebuilds are byte-identical rather than fighting the pre-commit
hook.

## Related

- [Vault cloud backup — Google Drive](../features/vault-cloud-backup-google-drive.md)
- [Agent orchestration pages](../agents/model-governance.md) — the same technique applied to the
  sub-agent fleet
