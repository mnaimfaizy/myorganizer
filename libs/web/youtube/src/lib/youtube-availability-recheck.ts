type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Asks every mounted `useYouTubeAvailability` to check again.
 *
 * Call it when a YouTube route answers 404. Withdrawn YouTube Access and the
 * global switch both make the routes answer as if absent (ADR 0129), with the
 * same body an unmatched route sends, so the response cannot say which 404 it
 * is — only the availability check can. An ordinary 404 (an Upload that is no
 * longer cached) re-checks to `true` and changes nothing.
 */
export function requestYouTubeAvailabilityRecheck(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes to re-check requests; returns the unsubscribe function. */
export function onYouTubeAvailabilityRecheck(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
