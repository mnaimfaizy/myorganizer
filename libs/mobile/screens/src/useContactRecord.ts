import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  useUnconfirmedEdit,
  useVaultBlob,
  recoversByReload,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import type { ListRowState } from '@myorganizer/mobile/ui';
import {
  findVisibleAddress,
  findVisibleMobileNumber,
  readUsageLocations,
  type ContactKind,
  type DecryptedAddress,
  type DecryptedMobileNumber,
  type DecryptedUsageLocation,
} from './contactModel';
import { useUsageLocationToggle } from './useUsageLocationToggle';

/** The decrypted record each kind reads as. */
interface ContactByKind {
  address: DecryptedAddress;
  mobileNumber: DecryptedMobileNumber;
}

/**
 * Which contact kind each Vault Blob Type holds, pinned over the whole Guarded
 * Enum (ADR 0053): a Vault Blob Type added later has to say here whether it
 * is a contact, instead of compiling past this file unnoticed.
 */
const CONTACT_KIND_BY_BLOB_TYPE = {
  [VaultBlobType.Addresses]: 'address',
  [VaultBlobType.MobileNumbers]: 'mobileNumber',
  [VaultBlobType.Groceries]: null,
  [VaultBlobType.Subscriptions]: null,
  [VaultBlobType.Tasks]: null,
} as const satisfies Record<VaultBlobType, ContactKind | null>;

/** The Vault Blob Type that holds `kind`, read back out of the pinned table. */
function blobTypeFor(kind: ContactKind): VaultBlobType {
  const entry = (
    Object.entries(CONTACT_KIND_BY_BLOB_TYPE) as [
      VaultBlobType,
      ContactKind | null,
    ][]
  ).find(([, contactKind]) => contactKind === kind);
  if (entry === undefined) {
    throw new Error(`No Vault Blob Type holds contact kind "${kind}".`);
  }
  return entry[0];
}

/** How each kind finds one of its records in a decrypted payload. */
const FIND_CONTACT = {
  address: findVisibleAddress,
  mobileNumber: findVisibleMobileNumber,
} as const satisfies {
  [K in ContactKind]: (records: unknown, id: string) => ContactByKind[K] | null;
};

/**
 * Where one contact's Usage Location ticks stand — the Unconfirmed Edit
 * state (CONTEXT.md) the rows draw, and the ways forward from a revert.
 */
export interface UsageLocationEdits {
  /** The Usage Location whose tick is in flight, if any. */
  pendingId: string | null;
  /**
   * The Usage Location whose tick the server has just confirmed — it has
   * moved group, and plays the enter motion where it lands.
   */
  arrivedId: string | null;
  /** A tick is in flight; another waits for it. */
  writing: boolean;
  rowState: (id: string) => ListRowState;
  toggle: (location: DecryptedUsageLocation) => void;
  /** Retry after a failure, or Reload after a conflict. */
  retry: () => void;
  retryLabel: string;
  /** Why the last tick was put back, for the reverted row's note. */
  revertedReason: string | undefined;
}

export interface ContactRecord<K extends ContactKind> {
  loading: boolean;
  loadError: unknown;
  reload: () => Promise<unknown>;
  /** The record, or `null` when the payload holds none — deleted on another
   * device while this screen was open. */
  contact: ContactByKind[K] | null;
  usageLocations: DecryptedUsageLocation[];
  edits: UsageLocationEdits;
}

/**
 * One Address or Mobile Number, read out of its Vault Blob, with the one edit
 * the Details tab offers on it: ticking a Usage Location notified, as an
 * Unconfirmed Edit through the existing push path (#917). Both detail screens
 * and the Usage Locations screen read a contact through this, so a tick made
 * on one is drawn the same way on the others.
 */
export function useContactRecord<K extends ContactKind>(
  kind: K,
  id: string,
): ContactRecord<K> {
  const {
    snapshot,
    loading,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(blobTypeFor(kind));

  const contact = useMemo(
    () =>
      (
        FIND_CONTACT[kind] as (
          records: unknown,
          id: string,
        ) => ContactByKind[K] | null
      )(snapshot?.envelope.records, id),
    [kind, snapshot, id],
  );
  const usageLocations = useMemo(
    () => (contact === null ? [] : readUsageLocations(contact)),
    [contact],
  );

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    useUnconfirmedEdit(apply, retry, reload);

  const toggle = useUsageLocationToggle(contact, push);

  // A tick the server confirmed moves its row to the other group; the row
  // plays the enter motion where it lands (Motion sheet).
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const previousPendingId = useRef(pendingId);
  useEffect(() => {
    const was = previousPendingId.current;
    previousPendingId.current = pendingId;
    if (was != null && pendingId == null && revertedId !== was) {
      setArrivedId(was);
    }
  }, [pendingId, revertedId]);

  const rowState = useCallback(
    (rowId: string): ListRowState =>
      pendingId === rowId
        ? 'unconfirmed'
        : revertedId === rowId && writeError != null
          ? 'reverted'
          : 'normal',
    [pendingId, revertedId, writeError],
  );

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];

  const retryEdit = useCallback((): void => {
    if (recoversByReload(writeError)) void reloadAfterConflict();
    else void retryFailedEdit();
  }, [writeError, reloadAfterConflict, retryFailedEdit]);

  return {
    loading,
    loadError,
    reload,
    contact,
    usageLocations,
    edits: {
      pendingId,
      arrivedId,
      writing,
      rowState,
      toggle,
      retry: retryEdit,
      retryLabel: notice?.action ?? 'Retry',
      revertedReason: notice?.message,
    },
  };
}
