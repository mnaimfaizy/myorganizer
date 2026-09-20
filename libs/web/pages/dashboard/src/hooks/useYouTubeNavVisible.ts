'use client';

import { getYouTubeAvailability } from '@myorganizer/web-youtube';
import { useEffect, useState } from 'react';

export function useYouTubeNavVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getYouTubeAvailability()
      .then((available) => {
        if (cancelled) return;
        setVisible(available);
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
