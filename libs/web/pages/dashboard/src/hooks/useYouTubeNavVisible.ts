'use client';

import { Configuration, YouTubeApi } from '@myorganizer/app-api-client';
import { getApiBaseUrl } from '@myorganizer/core';
import { useEffect, useState } from 'react';

export function useYouTubeNavVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const api = new YouTubeApi(
      new Configuration({ basePath: getApiBaseUrl() }),
    );

    api
      .getAvailability()
      .then((response) => {
        if (cancelled) return;
        setVisible(response.data.available === true);
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
