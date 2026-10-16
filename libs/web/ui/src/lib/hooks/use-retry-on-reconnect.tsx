import * as React from 'react';

/**
 * While `enabled`, calls `retry` when the browser comes back online, when the
 * window regains focus, or when the tab becomes visible again. Listeners are
 * removed when `enabled` turns false or the component unmounts.
 *
 * `retry` is read through a ref, so callers need not memoize it; the listeners
 * are only re-attached when `enabled` changes. Callers are responsible for
 * ignoring a retry while one is already in flight.
 */
export function useRetryOnReconnect(enabled: boolean, retry: () => void): void {
  const retryRef = React.useRef(retry);

  React.useEffect(() => {
    retryRef.current = retry;
  }, [retry]);

  React.useEffect(() => {
    if (!enabled) return undefined;

    const handleReconnect = () => {
      retryRef.current();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') retryRef.current();
    };

    window.addEventListener('online', handleReconnect);
    window.addEventListener('focus', handleReconnect);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleReconnect);
      window.removeEventListener('focus', handleReconnect);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);
}
