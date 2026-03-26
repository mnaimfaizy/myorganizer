// Types shared across YouTube components
export interface YouTubeVideo {
  id: string;
  videoId: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  channelTitle?: string;
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
export type ViewMode = 'grid' | 'carousel';
