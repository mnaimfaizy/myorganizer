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
  /**
   * Whether this Cached Upload is a Short.
   *
   * **Currently an API-contract gap.** Shorts already arrive in the channel
   * uploads playlist alongside long-form uploads, but neither the Prisma
   * `YouTubeVideo` model nor the video DTO carries a duration or Shorts marker,
   * so nothing can classify them yet. The Shorts page reads this field and
   * shows its "no Shorts yet" empty state until sync populates it — per the
   * prototype rules, the missing data is reported rather than invented.
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
