'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChannelCarousel,
  NotificationSettings,
  SortOption,
  YouTubeSubscription,
  YouTubeVideo,
} from '../types';

const API_BASE = '/api/v1/youtube';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
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

export function useYouTubeVideos() {
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
  }, [sort, search, page]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

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

  return { channels, loading, refresh: fetch_ };
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
