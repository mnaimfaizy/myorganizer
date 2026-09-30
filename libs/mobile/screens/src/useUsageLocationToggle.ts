import { useCallback } from 'react';
import {
  putVaultRecord,
  type UsageLocationRecord,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core/portable';
import {
  isNotified,
  readUsageLocations,
  type DecryptedUsageLocation,
} from './contactModel';

/** The shape both `AddressDetailScreen` and `MobileNumberDetailScreen` edit:
 * an Address or Mobile Number, decrypted and defensively parsed. */
type ToggleableContact = Record<string, unknown> & {
  id: string;
  usageLocations?: unknown;
};

/**
 * Ticking one Usage Location's notified state — the one edit either Detail
 * screen offers (Issue #917: "ticking notified is the only edit, as an
 * Unconfirmed Edit through the existing push path").
 *
 * Shared rather than written twice: an Address and a Mobile Number carry
 * their Usage Locations the same way, so the edit that flips one record's
 * `changed` field and re-stamps `updatedAt` is one function, not a pair that
 * could drift the moment only one of them is fixed.
 */
export function useUsageLocationToggle(
  contact: ToggleableContact | null,
  push: (
    id: string,
    edit: (envelope: VaultBlobEnvelope<unknown>) => VaultBlobEnvelope<unknown>,
  ) => Promise<boolean>,
): (location: DecryptedUsageLocation) => void {
  return useCallback(
    (location: DecryptedUsageLocation): void => {
      if (contact === null) return;
      const now = new Date().toISOString();
      const nextChanged = !isNotified(location);
      const nextUsageLocations = readUsageLocations(contact).map((entry) => {
        if (entry.id !== location.id) return entry;
        const updated = { ...entry, changed: nextChanged };
        if (nextChanged) {
          updated.changedAt = now;
        } else {
          delete updated.changedAt;
        }
        return updated;
      });
      void push(location.id, (envelope) =>
        putVaultRecord(envelope, {
          ...contact,
          usageLocations: nextUsageLocations as UsageLocationRecord[],
          updatedAt: now,
        }),
      );
    },
    [contact, push],
  );
}
