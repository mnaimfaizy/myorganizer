/**
 * User-facing copy for a Server Reachability reading — what a User is told
 * *before* they commit a change, where `vaultMetaPushMessages.ts` says what
 * they are told after.
 *
 * The two files sit together on purpose. They speak about the same server to
 * the same User either side of a single button, and copy that disagrees
 * across that boundary — a calm pre-commit line followed by an alarmed toast,
 * or the reverse — reads as the product changing its mind.
 *
 * Same split as everywhere else: `@myorganizer/web-vault` decides what
 * happened and carries no English text, and the library that shows a User owns
 * naming it. No string here is built from an error, so no server response body
 * can reach a User through this file.
 */
import type { ServerReachability } from '@myorganizer/web-vault';

/**
 * How loudly a Server Reachability reading is presented.
 *
 * No `error`, for the reason the reading is not a verdict: nothing has failed
 * when this is shown, because nothing has been attempted yet beyond the read
 * that produced it.
 */
export type ServerReachabilityTone = 'ok' | 'attention';

export type ServerReachabilityReading = {
  tone: ServerReachabilityTone;
  /**
   * Short state label. Null when the server was reached — a reading that
   * found nothing wrong adds no chrome, the same choice
   * `describeVaultSyncStatus` makes for a healthy sync.
   *
   * It is also the only honest option. An affirmative "server reachable"
   * would promise the next write will land, which no reading can: a third
   * device can move the server between the read and the push.
   */
  label: string | null;
  /** What it means, and what the User can still do. Null when reached. */
  detail: string | null;
  /**
   * Whether re-running the probe is something the User can act on. False for
   * a session that ended: the repair is signing in, which happens elsewhere,
   * and a button that re-checks something the User cannot have changed
   * teaches them the button does not work.
   */
  canRecheck: boolean;
};

/**
 * Every Server Reachability state and what a User is told about it. One table
 * rather than the state → tone → copy indirection `vaultMetaPushMessages.ts`
 * uses: that exists because seven push outcomes collapse into three readings,
 * and here all three states say different things. Pinned with `satisfies` so
 * a fourth state fails to compile until somebody writes its copy — see
 * ADR 0053.
 *
 * Both warnings open by saying the rotation can still go ahead. That clause
 * is load-bearing, not padding: a warning sitting immediately above a confirm
 * button reads as a stop sign unless it says otherwise, and stopping is the
 * wrong move — the new key works on this device the moment it is written,
 * whatever the server can be reached to do.
 */
export const SERVER_REACHABILITY_READINGS = {
  reachable: { tone: 'ok', label: null, detail: null, canRecheck: false },
  unreachable: {
    tone: 'attention',
    label: 'Your other devices cannot be reached right now',
    detail:
      'You can still rotate now — your new key will work on this device immediately. Your old key will keep opening your vault everywhere else until this device reconnects and sends the change.',
    canRecheck: true,
  },
  'signed-out': {
    tone: 'attention',
    label: 'Your session has ended',
    detail:
      'You can still rotate now — your new key will work on this device immediately. Sign in again to send the change to your other devices; waiting for a connection will not do it on its own.',
    canRecheck: false,
  },
} as const satisfies Record<ServerReachability, ServerReachabilityReading>;

/**
 * Turn a Server Reachability reading into what a User should be told.
 *
 * `null` means no reading has resolved yet — the probe is in flight, or none
 * has run. It reads as `reachable` does, showing nothing, rather than as a
 * "checking" state: a spinner immediately above a confirm button tells a User
 * to wait for it, and waiting is precisely what this must never ask for.
 */
export function serverReachabilityReading(
  reachability: ServerReachability | null,
): ServerReachabilityReading {
  if (!reachability) return SERVER_REACHABILITY_READINGS.reachable;
  return SERVER_REACHABILITY_READINGS[reachability];
}
