'use client';

import { clearAuthSession, getAccessToken, refresh } from '@myorganizer/auth';
import { getApiBaseUrl } from '@myorganizer/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChannelCarousel,
  NotificationSettings,
  SortOption,
  YouTubeSubscription,
  YouTubeVideo,
} from '../types';

// Helper: centralize cooldown derivation & formatting so UI components
// and other hooks use a single authoritative implementation.
export function isRetryCooldownActive(retryAt?: string | null) {
  if (!retryAt) return false;
  const t = Date.parse(retryAt);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

export function formatRetryAt(retryAt?: string | null) {
  if (!retryAt) return null;
  const d = new Date(retryAt);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function getYouTubeApiBase(): string {
  return `${getApiBaseUrl()}/youtube`;
}

let refreshInFlight: Promise<unknown> | null = null;

async function doFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${getYouTubeApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401) {
    try {
      if (!refreshInFlight) {
        refreshInFlight = refresh();
      }
      await refreshInFlight;
    } catch {
      clearAuthSession();
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Request failed: ${res.status}`);
    } finally {
      refreshInFlight = null;
    }
    res = await doFetch(path, options);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useYouTubeStatus() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('loading');
  const didMount = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ connected: boolean; status: string }>(
        '/status',
      );
      setConnected(data.connected);
      setStatus(data.status);
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      apiFetch<{ connected: boolean; status: string }>('/status')
        .then((data) => {
          setConnected(data.connected);
          setStatus(data.status);
        })
        .catch(() => setStatus('error'));
    }
  }, []);

  return { connected, status, refresh };
}

export function useYouTubeSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<YouTubeSubscription[]>('/subscriptions');
      setSubscriptions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      // Enforce authoritative backend cooldown before attempting PUT
      const status =
        await apiFetch<import('../types').YouTubeSyncStatus>('/sync-status');
      if (isRetryCooldownActive(status.retryAt)) {
        throw new Error(
          `Sync disabled until ${formatRetryAt(status.retryAt) ?? status.retryAt}`,
        );
      }
      await apiFetch('/subscriptions/sync', { method: 'PUT' });
      await fetch_();
    } finally {
      setLoading(false);
    }
  }, [fetch_]);

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      await apiFetch(`/subscriptions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      await fetch_();
    },
    [fetch_],
  );

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return { subscriptions, loading, sync, toggle, refresh: fetch_ };
}

export function useYouTubeVideos(channelId?: string) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>('latest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '24');
      if (search) params.set('search', search);
      if (channelId) params.set('channelId', channelId);
      const data = await apiFetch<{
        videos: YouTubeVideo[];
        total: number;
        totalPages: number;
      }>(`/videos?${params.toString()}`);
      setVideos(data.videos);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [sort, search, page, channelId]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  const updateWatched = useCallback((videoId: string, watched: boolean) => {
    setVideos((prev) =>
      prev.map((v) => (v.videoId === videoId ? { ...v, watched } : v)),
    );
  }, []);

  return {
    videos,
    total,
    totalPages,
    loading,
    sort,
    setSort,
    search,
    setSearch,
    page,
    setPage,
    updateWatched,
    refresh: fetch_,
  };
}

export function useYouTubeCarousel() {
  const [channels, setChannels] = useState<ChannelCarousel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ChannelCarousel[]>('/videos/carousel');
      setChannels(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  const updateWatched = useCallback((videoId: string, watched: boolean) => {
    setChannels((prev) =>
      prev.map((channel) => ({
        ...channel,
        videos: channel.videos.map((v) =>
          v.videoId === videoId ? { ...v, watched } : v,
        ),
      })),
    );
  }, []);

  return { channels, loading, updateWatched, refresh: fetch_ };
}

export function useYouTubeNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>({
    intervalDays: 7,
    enabled: true,
    lastNotifiedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const data = await apiFetch<NotificationSettings>(
        '/notification-settings',
      );
      setSettings(data);
    } catch {
      // Use defaults
    }
  }, []);

  const update = useCallback(async (data: Partial<NotificationSettings>) => {
    setLoading(true);
    try {
      const result = await apiFetch<NotificationSettings>(
        '/notification-settings',
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
      setSettings(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return { settings, loading, update };
}

export function useYouTubeConnect() {
  const connect = useCallback(async () => {
    const data = await apiFetch<{ url: string }>('/auth-url');
    window.location.href = data.url;
  }, []);

  const disconnect = useCallback(async () => {
    await apiFetch('/disconnect', { method: 'DELETE' });
  }, []);

  return { connect, disconnect };
}

export function useYouTubeSyncStatus() {
  const [status, setStatus] = useState<
    import('../types').YouTubeSyncStatus | null
  >(null);
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        await apiFetch<import('../types').YouTubeSyncStatus>('/sync-status');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure we have the authoritative sync-status from the backend
      const latest =
        await apiFetch<import('../types').YouTubeSyncStatus>('/sync-status');
      setStatus(latest);
      if (isRetryCooldownActive(latest.retryAt)) {
        throw new Error(
          `Sync disabled until ${formatRetryAt(latest.retryAt) ?? latest.retryAt}`,
        );
      }

      // Backend PUT /youtube/subscriptions/sync returns YouTubeSyncResult
      const data = await apiFetch<import('../types').YouTubeSyncResult>(
        '/subscriptions/sync',
        {
          method: 'PUT',
        },
      );

      // Update local status from the result
      setStatus({
        status: data.status,
        lastSyncedAt: data.lastSyncedAt,
        lastSyncAttemptAt: data.lastSyncAttemptAt,
        lastSyncError: data.lastSyncError,
        retryAt: data.retryAt,
      });

      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      void fetch_();
    }
  }, [fetch_]);

  const isCooldownActive = !!(status && isRetryCooldownActive(status.retryAt));

  return { status, loading, refresh: fetch_, triggerSync, isCooldownActive };
}

export async function updateVideoWatched(
  videoId: string,
  watched: boolean,
): Promise<{ ok: boolean; watched: boolean }> {
  return apiFetch<{ ok: boolean; watched: boolean }>(
    `/videos/${encodeURIComponent(videoId)}/watched`,
    {
      method: 'PATCH',
      body: JSON.stringify({ watched }),
    },
  );
}
