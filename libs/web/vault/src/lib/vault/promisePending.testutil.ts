/**
 * Test support for the one thing a regression test about an unanswered
 * dialog has to say: the pass is still running.
 *
 * A prompt that never settles is how a test models a User who has been shown
 * the `different-vault` dialog and has not answered it — the case
 * [ADR 0067](../../../../../docs/adr/0067-a-vault-blob-is-never-taken-across-a-vault-identity.md)'s
 * amendment exists for. Such a test cannot await the pass it started, so it
 * has to assert two separate things: that the observation was recorded, and
 * that the pass genuinely has not settled. Only the second one proves the
 * first was not simply the pass finishing early.
 *
 * The deliberate hang is also a hazard. A pending promise left behind by one
 * test resumes inside a later one and writes to that test's `localStorage` —
 * which is exactly how `vaultSyncQueue.test.ts` came to fail three runs in
 * five (commit `a4bf925`). Racing it here keeps the hang inside the test that
 * created it.
 *
 * Not a `.test.ts` file: it holds no tests, and the `.testutil.ts` suffix is
 * what keeps it out of the shipped library while the spec program still sees
 * it (see this project's `tsconfig.lib.json` and `tsconfig.spec.json`).
 */

/** How long a pending promise is watched before it counts as pending. */
const STILL_PENDING_WINDOW_MS = 10;

/**
 * Assert `promise` has neither resolved nor rejected.
 *
 * Races it against a timer, so a promise that settles first fails the
 * assertion with its own value rather than this helper's sentinel.
 */
export async function expectStillPending(promise: Promise<unknown>) {
  const sentinel = Symbol('still-pending');
  const timeout = new Promise<typeof sentinel>((resolve) =>
    setTimeout(() => resolve(sentinel), STILL_PENDING_WINDOW_MS),
  );

  await expect(Promise.race([promise, timeout])).resolves.toBe(sentinel);
}
