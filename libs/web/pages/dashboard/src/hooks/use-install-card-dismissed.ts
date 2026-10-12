import * as React from 'react';

const DISMISSED_KEY = 'myorganizer.install-card.dismissed.v1';

// A per-device convenience, not account data: no user id is in the key and
// nothing is synced.
const dismissedListeners = new Set<() => void>();
// null until first read, so storage is touched only on the client.
let dismissedState: boolean | null = null;

function readDismissedFromStorage(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeDismissedToStorage(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Storage is unavailable or full. The card stays hidden for this page
    // session and may reappear on a later visit.
  }
}

function subscribeDismissed(onStoreChange: () => void): () => void {
  dismissedListeners.add(onStoreChange);
  return () => {
    dismissedListeners.delete(onStoreChange);
  };
}

function getDismissedSnapshot(): boolean {
  if (dismissedState === null) {
    dismissedState = readDismissedFromStorage();
  }
  return dismissedState;
}

function getServerDismissedSnapshot(): boolean {
  return false;
}

function dismissInstallCard(): void {
  dismissedState = true;
  writeDismissedToStorage();
  dismissedListeners.forEach((listener) => listener());
}

/**
 * Whether the User has dismissed the install card on this device. `dismiss`
 * hides it here and persists the choice across visits.
 */
export function useInstallCardDismissed(): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const dismissed = React.useSyncExternalStore(
    subscribeDismissed,
    getDismissedSnapshot,
    getServerDismissedSnapshot,
  );
  return { dismissed, dismiss: dismissInstallCard };
}
