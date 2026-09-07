'use client';

import { useCallback } from 'react';
import type { ChannelCarousel } from '../types';

/**
 * Uploads per channel returned by the channel list endpoint. Sync caches the
 * latest 100 per channel, so anything past this is reachable only by asking
 * for the rest — see `onLoadMoreUploads`.
 */
export const CHANNEL_LIST_UPLOAD_CAP = 20;

interface UseCachedUploadExpansionParams {
  effectiveSelectedChannelId: string | null;
  selectedChannel: ChannelCarousel | null | undefined;
  onLoadMoreUploads?: (channelId: string) => void;
  loadingMoreChannelIds?: ReadonlySet<string>;
  fullyLoadedChannelIds?: ReadonlySet<string>;
}

interface UseCachedUploadExpansionResult {
  isLoadingMoreUploads: boolean;
  canLoadMoreUploads: boolean;
  handleLoadMoreUploads: () => void;
}

export function useCachedUploadExpansion({
  effectiveSelectedChannelId,
  selectedChannel,
  onLoadMoreUploads,
  loadingMoreChannelIds,
  fullyLoadedChannelIds,
}: UseCachedUploadExpansionParams): UseCachedUploadExpansionResult {
  // The channel list arrives capped, so a channel sitting exactly on the cap
  // probably has more behind it. Offering to load is a guess by design: the
  // response settles it, and a channel that turns out to hold exactly the cap
  // simply loses the button on the next render. The alternative — a per
  // channel total on the list endpoint — is an API contract change for a
  // button label.
  const isLoadingMoreUploads = effectiveSelectedChannelId
    ? (loadingMoreChannelIds?.has(effectiveSelectedChannelId) ?? false)
    : false;
  const canLoadMoreUploads =
    !!onLoadMoreUploads &&
    !!effectiveSelectedChannelId &&
    !fullyLoadedChannelIds?.has(effectiveSelectedChannelId) &&
    (selectedChannel?.videos.length ?? 0) >= CHANNEL_LIST_UPLOAD_CAP;

  const handleLoadMoreUploads = useCallback(() => {
    if (!effectiveSelectedChannelId) return;
    onLoadMoreUploads?.(effectiveSelectedChannelId);
  }, [effectiveSelectedChannelId, onLoadMoreUploads]);

  return {
    isLoadingMoreUploads,
    canLoadMoreUploads,
    handleLoadMoreUploads,
  };
}
