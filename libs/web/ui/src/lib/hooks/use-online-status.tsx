import * as React from 'react';

// Module-level so the subscribe and snapshot identities are stable across
// renders; useSyncExternalStore would otherwise resubscribe on every render.
function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// Server and hydration render assume a connection, so the server output never
// mismatches the client's first render. A real reading arrives after hydration.
function getServerSnapshot() {
  return true;
}

/**
 * True when the browser reports a network connection. Reflects the browser's
 * `online` / `offline` events only: it is not a reachability probe, so a
 * connected browser can still fail to reach the server.
 */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
