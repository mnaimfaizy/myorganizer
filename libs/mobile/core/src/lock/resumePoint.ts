// Where the User was when the Vault locked under them, so that unlocking
// again returns them there instead of to the top of a default tab.
//
// In memory only, and deliberately not a Device Setting: it describes this run
// of the app rather than this installation, and an offset restored onto a list
// the server has moved on from is worse than the top of that list. It holds a
// route name and a pixel offset and nothing else — never vault plaintext,
// which the lock has already dropped by the time this is read back.
//
// The *tab* is not here. That one already survives a lock as the `lastTab`
// Device Setting, which the tab navigator reads when it mounts; recording it a
// second time would be a second source of truth for the same answer.

const offsets = new Map<string, number>();

/**
 * Record where a scrolling screen is. Called as the User scrolls, so it takes
 * the offset it is given and does no work: the read happens once, on the next
 * mount.
 */
export function rememberScrollOffset(key: string, offset: number): void {
  offsets.set(key, offset);
}

/**
 * Where that screen was, or the top when this run has not seen it. Zero rather
 * than `null` because every caller would otherwise write the same `?? 0`, and
 * "no memory of it" and "at the top" are the same screen.
 */
export function recallScrollOffset(key: string): number {
  return offsets.get(key) ?? 0;
}

/**
 * Drop every remembered offset. Logout, not lock: a lock is the one thing
 * these offsets exist to survive, while a logout ends the session they
 * describe and the next User must not land where the last one was reading.
 */
export function forgetResumePoint(): void {
  offsets.clear();
}
