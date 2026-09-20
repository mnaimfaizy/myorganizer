'use client';

import { getAccessToken } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useYouTubeAvailability } from '../hooks';

export default function YouTubeCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const didRun = useRef(false);
  const { available } = useYouTubeAvailability();

  const handleBack = useCallback(() => {
    router.replace('/dashboard');
  }, [router]);

  const isUnavailable = available !== true;

  useEffect(() => {
    if (didRun.current) return;
    if (isUnavailable) return;

    didRun.current = true;

    (async () => {
      const code = searchParams.get('code');
      if (!code) {
        setError('No authorization code received from Google.');
        return;
      }

      const token = getAccessToken();
      if (!token) {
        setError('You must be logged in to connect YouTube.');
        return;
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/youtube/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.message ?? 'Failed to connect YouTube.');
          return;
        }

        router.replace('/dashboard/youtube');
      } catch {
        setError('Something went wrong while connecting YouTube.');
      }
    })();
  }, [searchParams, router, isUnavailable]);

  if (isUnavailable) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground text-lg font-medium">
          YouTube is not available right now.
        </p>
        <p className="text-muted-foreground text-sm">Please try again later.</p>
        <button className="text-primary underline text-sm" onClick={handleBack}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive text-lg font-medium">
          Connection Failed
        </p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <button className="text-primary underline text-sm" onClick={handleBack}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground text-lg">
        Connecting your YouTube account…
      </p>
    </div>
  );
}
