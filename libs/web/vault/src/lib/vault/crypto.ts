/**
 * The Vault's crypto primitives, re-exported from `@myorganizer/vault-core`.
 *
 * The implementations moved to `vault-core` so the standalone Escape Copy
 * reader can be bundled from the same source the exporter runs
 * ([ADR 0064](../../../../../docs/adr/0064-an-escape-copy-is-opened-by-a-tool-that-needs-nothing-of-ours.md)).
 * A reader carrying its own hand-copied PBKDF2 or AES-GCM would be a second
 * implementation of the one thing that must never disagree with the first,
 * and it would disagree silently — at the only moment anybody runs it.
 *
 * This file stays as the import site every caller in `web-vault` already
 * names, so the move is invisible to them and to `@myorganizer/web-vault`'s
 * public surface.
 */
export {
  aesGcmDecrypt,
  aesGcmEncrypt,
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  deriveKeyFromPassphrase,
  importAesGcmKey,
  randomBytes,
  utf8ToBytes,
} from '@myorganizer/vault-core';
export type { Base64String } from '@myorganizer/vault-core';
