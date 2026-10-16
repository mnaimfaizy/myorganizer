import { useCallback } from 'react';
import type { VaultBlobEnvelope } from '@myorganiser/vault-core/portable';
import { isNotified, type DecryptedUsageLocation } from './contactModel';
import {
  usageLocationToggleEdit,
  type ToggleableContact,
} from './vaultRecordEdits';

/**
 * Ticking one Usage Location's notified state — the one edit either Detail
 * screen offers (Issue #917: "ticking notified is the only edit, as an
 * Unconfirmed Edit through the existing push path").
 *
 * Shared rather than written twice: an Address and a Mobile Number carry
 * their Usage Locations the same way, so the edit that flips one record's
 * `changed` field and re-stamps `updatedAt` is one function, not a pair that
 * could drift the moment only one of them is fixed. The edit itself is
 * `usageLocationToggleEdit`, pure so it can be tested on its own.
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
      void push(
        location.id,
        usageLocationToggleEdit(
          contact,
          location.id,
          !isNotified(location),
          new Date().toISOString(),
        ),
      );
    },
    [contact, push],
  );
}
