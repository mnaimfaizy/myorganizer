'use client';

import { getApiBaseUrl } from '@myorganizer/core';
import { useEffect, useState } from 'react';

export function useYouTubeNavVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${getApiBaseUrl()}/youtube/availability`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setVisible(false);
          return;
        }
        const data = (await response.json()) as { available: boolean };
        if (!cancelled) {
          setVisible(data.available === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisible(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return visible;
}
