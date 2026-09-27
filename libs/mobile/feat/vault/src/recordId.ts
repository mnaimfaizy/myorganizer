import { mobileVaultCrypto } from './crypto';

/**
 * A fresh record id: a random RFC 4122 version 4 UUID, the shape
 * `crypto.randomUUID()` gives the web vault.
 *
 * Drawn from `mobileVaultCrypto` rather than a global `crypto`, which the
 * native program does not declare (ADR 0103) and Hermes does not provide.
 */
export function newRecordId(): string {
  const bytes = mobileVaultCrypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
