'use client';

import { useEffect, useState } from 'react';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let loadPromise: Promise<void> | null = null;

function ensureScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cannot load GIS in non-browser env'));
  }
  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services script')),
      );
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(new Error('Failed to load Google Identity Services script')),
    );
    document.head.appendChild(script);
  });

  return loadPromise;
}

export type GoogleIdentityScriptStatus = 'loading' | 'ready' | 'error';

/**
 * Loads the Google Identity Services script (`https://accounts.google.com/gsi/client`)
 * exactly once per page load. Returns a status flag callers can use to gate
 * provider construction.
 */
export function useGoogleIdentityScript(): GoogleIdentityScriptStatus {
  const [status, setStatus] = useState<GoogleIdentityScriptStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    void ensureScript()
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
