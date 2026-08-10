// Types shared across YouTube components
export interface YouTubeVideo {
  id: string;
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  channelTitle?: string;
  description?: string;
  watched: boolean;
  /** Runtime in seconds, or null for uploads cached before duration collection. */
  durationSeconds?: number | null;
  /**
   * Whether this Cached Upload is a Short, classified server-side from its
   * runtime. Unclassified uploads are never Shorts, so a sync gap leaves a
   * video on the long-form home rather than hiding it behind the daily budget.
   */
  isShort?: boolean;
}

export interface YouTubeSubscription {
  id: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  uploadsPlaylistId: string;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface ChannelCarousel {
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
  videos: YouTubeVideo[];
}

export interface NotificationSettings {
  intervalDays: number;
  enabled: boolean;
  lastNotifiedAt: string | null;
}

export type SortOption = 'latest' | 'oldest' | 'az';

export interface YouTubeSyncStatus {
  status:
    | 'never'
    | 'running'
    | 'success'
    | 'partial'
    | 'failed'
    | 'quota_exceeded'
    | 'cooldown';
  lastSyncedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSyncError: string | null;
  retryAt: string | null;
}

export interface YouTubeSyncResult extends YouTubeSyncStatus {
  synced: number;
  videosSynced: number;
}
