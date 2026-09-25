import type { AddressRecord, MobileNumberRecord } from './contactRecords';
import { mergeRecordsById } from './mergeVaultRecords';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

/**
 * When a contact record last changed, for merge purposes.
 *
 * `updatedAt` is optional and absent on every record written before it
 * existed, so the required `createdAt` stands in.
 */
function contactChangedAt(
  record: AddressRecord | MobileNumberRecord,
): string | undefined {
  return record.updatedAt ?? record.createdAt;
}

/**
 * Converges two copies of the `addresses` Vault Blob.
 *
 * Pure: no crypto, no storage, no clock. Usage Locations travel with their
 * Address rather than merging on their own — an Address is the unit the User
 * edits, and splitting it would let two devices agree on an Address while
 * disagreeing about which organisations still need telling.
 */
export function mergeAddresses(
  local: VaultBlobEnvelope<AddressRecord[]>,
  remote: VaultBlobEnvelope<AddressRecord[]>,
): VaultBlobEnvelope<AddressRecord[]> {
  // Named explicitly: `contactChangedAt` reads either contact record, so left
  // to infer, the record type widens to the union of both and the result stops
  // being an Address blob.
  return mergeRecordsById<AddressRecord>(local, remote, contactChangedAt);
}

/** Converges two copies of the `mobileNumbers` Vault Blob. See `mergeAddresses`. */
export function mergeMobileNumbers(
  local: VaultBlobEnvelope<MobileNumberRecord[]>,
  remote: VaultBlobEnvelope<MobileNumberRecord[]>,
): VaultBlobEnvelope<MobileNumberRecord[]> {
  return mergeRecordsById<MobileNumberRecord>(local, remote, contactChangedAt);
}
