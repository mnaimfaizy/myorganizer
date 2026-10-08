import type { VaultBlobType } from '@myorganizer/app-api-client';

import type { VaultBlobSnapshot } from './sync';

/**
 * One write the server confirmed, as its controller tells the others: the
 * snapshot the server now holds, the Vault Blob Type it is, and the Master
 * Key it was written under. The snapshot is plaintext and the key is the key,
 * so this is passed between controllers in memory and goes nowhere else.
 */
export interface ConfirmedVaultBlobWrite {
  type: VaultBlobType;
  /** Compared by identity: each Vault Unlock holds its own key object. */
  masterKey: Uint8Array;
  snapshot: VaultBlobSnapshot;
}

export type VaultBlobPeerReceiver = (write: ConfirmedVaultBlobWrite) => void;

/**
 * The controllers of one `VaultProvider` that are on screen, so a write one
 * of them had confirmed reaches the others. It carries a write and decides
 * nothing: whether to take one is each receiver's own rule.
 */
export interface VaultBlobPeers {
  /** Starts receiving; the function returned stops it. */
  join: (receiver: VaultBlobPeerReceiver) => () => void;
  /** Hands `write` to every receiver but `from`, the controller that made it. */
  publish: (
    write: ConfirmedVaultBlobWrite,
    from: VaultBlobPeerReceiver,
  ) => void;
}

export function createVaultBlobPeers(): VaultBlobPeers {
  const receivers = new Set<VaultBlobPeerReceiver>();
  return {
    join: (receiver) => {
      receivers.add(receiver);
      return () => {
        receivers.delete(receiver);
      };
    },
    publish: (write, from) => {
      for (const receiver of [...receivers]) {
        if (receiver !== from) receiver(write);
      }
    },
  };
}
