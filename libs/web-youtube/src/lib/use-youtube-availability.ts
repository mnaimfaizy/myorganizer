'use client';

import { useEffect, useState } from 'react';
import { getYouTubeAvailability } from './web-youtube';

export interface YouTubeAvailabilityState {
  available: boolean | null;
  loading: boolean;
  error: Error | null;
}

export function useYouTubeAvailability(): YouTubeAvailabilityState {
  const [state, setState] = useState<YouTubeAvailabilityState>({
    available: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    getYouTubeAvailability()
      .then((available) => {
        if (!cancelled) {
          setState({ available, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            available: false,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
