'use client';

import { getAccessToken } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';
import { Card, CardContent, CardHeader, CardTitle } from '@myorganizer/web-ui';
import { Youtube } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type VideoItem = {
  videoId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  channelTitle?: string;
};

type State =
  | { status: 'loading' }
  | { status: 'disconnected' }
  | { status: 'loaded'; videos: VideoItem[] }
  | { status: 'error' };

export function RecentYouTubeCard() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const base = `${getApiBaseUrl()}/youtube`;
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    fetch(`${base}/status`, { headers, credentials: 'include' })
      .then((r) => r.json())
      .then((data: { connected: boolean }) => {
        if (!data.connected) {
          setState({ status: 'disconnected' });
          return;
        }

        return fetch(`${base}/videos?sort=latest&limit=6`, {
          headers,
          credentials: 'include',
        })
          .then((r) => r.json())
          .then((body: { videos: VideoItem[] }) => {
            setState({ status: 'loaded', videos: body.videos ?? [] });
          });
      })
      .catch(() => setState({ status: 'error' }));
  }, []);

  return (
    <Card className="md:col-span-4 col-span-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Recent YouTube Videos
        </CardTitle>
        <Youtube className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {state.status === 'disconnected' && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Youtube className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              YouTube is not connected.
            </p>
            <Link
              href="/dashboard/youtube"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Connect YouTube
            </Link>
          </div>
        )}

        {state.status === 'error' && (
          <p className="text-sm text-muted-foreground">
            Could not load videos. Try again later.
          </p>
        )}

        {state.status === 'loaded' && state.videos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No videos yet. Sync your subscriptions to see recent uploads.
          </p>
        )}

        {state.status === 'loaded' && state.videos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.videos.map((v) => (
              <a
                key={v.videoId}
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1.5 rounded-lg border p-2 transition-colors hover:bg-accent"
              >
                {v.thumbnail ? (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="aspect-video w-full rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-video w-full rounded-md bg-muted" />
                )}
                <p className="line-clamp-2 text-sm font-medium leading-tight group-hover:text-accent-foreground">
                  {v.title}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {v.channelTitle && <span>{v.channelTitle}</span>}
                  <span>{new Date(v.publishedAt).toLocaleDateString()}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
