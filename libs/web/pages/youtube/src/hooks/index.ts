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

export { useVideoQueue, QUEUE_CAP } from './useVideoQueue';
export type { VideoQueue } from './useVideoQueue';

export { useShortsBudget } from './useShortsBudget';
export type { ShortsBudget } from './useShortsBudget';
export {
  MIN_SHORTS_LIMIT_MINUTES,
  MAX_SHORTS_LIMIT_MINUTES,
  formatShortsDuration,
} from '../lib/shortsBudget';

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
      // Long-form surfaces exclude Shorts: short-form is isolated on its own
      // budgeted page (PRD #264, user story 14), so it must not reappear in
      // the channel grid or a channel's detail list.
      params.set('kind', 'long');
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

/**
 * Cached Uploads that are Shorts, for the separate Shorts page.
 *
 * Shorts arrive in the ordinary uploads playlist, so they are not a separate
 * resource — the server slices the same library by runtime via `kind=short`.
 * Filtering server-side keeps the page from downloading a full library to throw
 * most of it away, and keeps one classification rule rather than two.
 */
export function useYouTubeShorts() {
  const [shorts, setShorts] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: 'latest',
        page: '1',
        limit: '50',
        kind: 'short',
      });
      const data = await apiFetch<{ videos: YouTubeVideo[] }>(
        `/videos?${params.toString()}`,
      );
      setShorts(data.videos);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  const updateWatched = useCallback((videoId: string, watched: boolean) => {
    setShorts((prev) =>
      prev.map((v) => (v.videoId === videoId ? { ...v, watched } : v)),
    );
  }, []);

  return { shorts, loading, error, updateWatched, refresh: fetch_ };
}

export function useYouTubeCarousel() {
  const [channels, setChannels] = useState<ChannelCarousel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ChannelCarousel[]>('/videos/carousel');
      setChannels(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
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

  return { channels, loading, error, updateWatched, refresh: fetch_ };
}

export function useYouTubeNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>({
    // The digest is opt-in, so assume off until the server says otherwise.
    enabled: false,
    lastNotifiedAt: null,
    preferredWeekday: 1,
    timeZone: null,
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

/**
 * Uploads fetched per channel when expanding past the channel list cap.
 * Sync keeps the latest 100 per channel, so one page covers the whole
 * snapshot and there is never a second round.
 */
export const CHANNEL_UPLOAD_PAGE_SIZE = 100;

export interface ChannelUploadExpansion {
  /** Full upload lists, keyed by channel id, for channels already expanded. */
  uploadsByChannel: Record<string, YouTubeVideo[]>;
  /** Channels whose expansion is in flight. */
  loadingChannelIds: ReadonlySet<string>;
  /** Channels known to hold nothing further. */
  fullyLoadedChannelIds: ReadonlySet<string>;
  error: string | null;
  loadChannel: (channelId: string) => void;
  /** Mirrors a Watched change into any expanded list holding that upload. */
  updateWatched: (videoId: string, watched: boolean) => void;
}

/**
 * On-demand expansion of one channel past the channel list's cap.
 *
 * The channel list endpoint returns a bounded slice per channel so the home
 * page does not download every account's whole library on load. That slice is
 * the doom-scroll guardrail working as intended, but it also has to be
 * escapable: a digest can name an upload older than the slice, and the
 * end-of-list disclosure would otherwise be lying about what is cached.
 *
 * Expansion is per channel and sticky for the life of the page — re-selecting
 * an expanded channel does not refetch.
 */
export function useChannelUploads(): ChannelUploadExpansion {
  const [uploadsByChannel, setUploadsByChannel] = useState<
    Record<string, YouTubeVideo[]>
  >({});
  const [loadingChannelIds, setLoadingChannelIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [fullyLoadedChannelIds, setFullyLoadedChannelIds] = useState<
    Set<string>
  >(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef<Set<string>>(new Set());

  const loadChannel = useCallback((channelId: string) => {
    if (inFlightRef.current.has(channelId)) return;
    inFlightRef.current.add(channelId);

    setError(null);
    setLoadingChannelIds((prev) => new Set(prev).add(channelId));

    const params = new URLSearchParams({
      sort: 'latest',
      page: '1',
      limit: String(CHANNEL_UPLOAD_PAGE_SIZE),
      // Shorts stay on their own budgeted page (PRD #264, user story 14) and
      // must not leak back into a long-form channel list.
      kind: 'long',
      channelId,
    });

    void apiFetch<{ videos: YouTubeVideo[]; total: number }>(
      `/videos?${params.toString()}`,
    )
      .then((data) => {
        setUploadsByChannel((prev) => ({ ...prev, [channelId]: data.videos }));
        // One page covers the whole snapshot, so this channel is done unless
        // the server somehow held more than a page.
        if (data.videos.length >= data.total) {
          setFullyLoadedChannelIds((prev) => new Set(prev).add(channelId));
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        inFlightRef.current.delete(channelId);
        setLoadingChannelIds((prev) => {
          const next = new Set(prev);
          next.delete(channelId);
          return next;
        });
      });
  }, []);

  const updateWatched = useCallback((videoId: string, watched: boolean) => {
    setUploadsByChannel((prev) => {
      let changed = false;
      const next: Record<string, YouTubeVideo[]> = {};
      for (const [channelId, videos] of Object.entries(prev)) {
        if (!videos.some((v) => v.videoId === videoId)) {
          next[channelId] = videos;
          continue;
        }
        changed = true;
        next[channelId] = videos.map((v) =>
          v.videoId === videoId ? { ...v, watched } : v,
        );
      }
      return changed ? next : prev;
    });
  }, []);

  return {
    uploadsByChannel,
    loadingChannelIds,
    fullyLoadedChannelIds,
    error,
    loadChannel,
    updateWatched,
  };
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
