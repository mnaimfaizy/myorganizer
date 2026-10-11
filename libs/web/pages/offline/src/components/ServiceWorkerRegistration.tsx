'use client';

import { useEffect } from 'react';

// Registers the offline service worker once, on the client, after mount.
// Renders nothing: the worker takes over on its own, with no update prompt.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The worker is absent in local development so it cannot serve stale
    // bundles while code is being edited.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // The app works without the worker; a failed registration only costs
        // the offline page, so the rejection is deliberately swallowed.
      });
  }, []);

  return null;
}
