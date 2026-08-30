/**
 * The Local Vault Revision — a number that moves whenever a Local Vault is
 * replaced underneath whoever is reading it.
 *
 * It is the inbound counterpart to the Vault Sync Sink, and the two are
 * deliberately separate. The sink is told that one Vault Blob Type changed
 * *here*, so that the change can be sent; this is told that the whole Local
 * Vault was rewritten *from somewhere else*, so that what is already decrypted
 * on screen can be read again. Feeding one from the other would be a loop:
 * convergence writes through `saveVault` precisely so the sink does not hear
 * its own output back as a fresh edit (see `vaultHandle.ts`).
 *
 * It exists because convergence is invisible to a page. Vault Pull writes the
 * Local Vault and returns; a page that loaded its records once on mount goes
 * on rendering the copy it replaced. That is not merely stale display — every
 * page here saves the *whole* blob back from the array it is holding, so the
 * next edit writes a blob with the converged record missing, and the Sync
 * Bookmark advanced during convergence makes that push conditional-safe, so
 * the server takes it. A record that arrived correctly is then discarded by
 * the device that received it
 * ([#587](https://github.com/mnaimfaizy/myorganizer/issues/587)).
 *
 * A number rather than an event payload, and no Vault Blob Type on it. Readers
 * re-read what they already know how to read, which keeps this incapable of
 * carrying plaintext, incapable of disagreeing with the Local Vault about what
 * changed, and correct for a seventh Vault Blob Type nobody has told it about.
 * An extra read costs one decrypt of data this device already holds.
 *
 * Lives beside the Vault Sync Queue rather than on the Vault Handle, because
 * locking and unlocking build a new handle over the same Local Vault and a
 * subscription held on the handle would be dropped every time.
 */

/**
 * A revision counter and its subscribers. Shaped for `useSyncExternalStore`:
 * `current` is the snapshot, `subscribe` returns its own unsubscribe.
 */
export type LocalVaultRevision = {
  /** The current revision. Changes value; the value itself means nothing. */
  current(): number;
  /**
   * Announce that the Local Vault has been replaced. Never awaited and never
   * able to fail the write that called it, for the same reason the Vault Sync
   * Sink's report is not: the Local Vault is already written by then.
   */
  bump(): void;
  /** Be told when the revision moves. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
};

export function createLocalVaultRevision(): LocalVaultRevision {
  let revision = 0;
  const listeners = new Set<() => void>();

  return {
    current() {
      return revision;
    },

    bump() {
      revision += 1;
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          // One reader throwing must not stop the others from being told, and
          // must not reach the write that announced this.
        }
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
