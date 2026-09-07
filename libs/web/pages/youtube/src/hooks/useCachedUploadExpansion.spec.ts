import { renderHook, act } from '@testing-library/react';
import type { ChannelCarousel, YouTubeVideo } from '../types';
import {
  useCachedUploadExpansion,
  CHANNEL_LIST_UPLOAD_CAP,
} from './useCachedUploadExpansion';

const CHANNEL_ID = 'ch-alpha';

const baseVideo = (index: number): YouTubeVideo => ({
  id: `vid-${index}`,
  videoId: `vid-${index}`,
  channelId: CHANNEL_ID,
  title: `Video ${index}`,
  thumbnail: null,
  publishedAt: '2025-12-01T00:00:00Z',
  channelTitle: 'Test Channel',
  watched: false,
});

const makeVideos = (count: number): YouTubeVideo[] =>
  Array.from({ length: count }, (_, i) => baseVideo(i + 1));

const makeChannel = (videoCount: number): ChannelCarousel => ({
  channelId: CHANNEL_ID,
  channelTitle: 'Alpha Channel',
  channelThumbnail: null,
  videos: makeVideos(videoCount),
});

describe('useCachedUploadExpansion', () => {
  describe('canLoadMoreUploads', () => {
    it('should stay false at cap when no onLoadMoreUploads handler is provided', () => {
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
        }),
      );

      expect(result.current.canLoadMoreUploads).toBe(false);
    });

    it('should stay false when no channel is selected', () => {
      const onLoadMoreUploads = jest.fn();
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: null,
          selectedChannel,
          onLoadMoreUploads,
        }),
      );

      expect(result.current.canLoadMoreUploads).toBe(false);
      expect(result.current.isLoadingMoreUploads).toBe(false);

      act(() => {
        result.current.handleLoadMoreUploads();
      });

      expect(onLoadMoreUploads).not.toHaveBeenCalled();
    });

    it('should stay false when uploads are below the cap', () => {
      const onLoadMoreUploads = jest.fn();
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP - 1);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
          onLoadMoreUploads,
        }),
      );

      expect(result.current.canLoadMoreUploads).toBe(false);
    });

    it('should be true at cap when handler is present and channel is not fully loaded', () => {
      const onLoadMoreUploads = jest.fn();
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
          onLoadMoreUploads,
        }),
      );

      expect(result.current.canLoadMoreUploads).toBe(true);
    });

    it('should stay false when the channel is marked fully loaded', () => {
      const onLoadMoreUploads = jest.fn();
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);
      const fullyLoadedChannelIds = new Set([CHANNEL_ID]);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
          onLoadMoreUploads,
          fullyLoadedChannelIds,
        }),
      );

      expect(result.current.canLoadMoreUploads).toBe(false);
    });
  });

  describe('isLoadingMoreUploads', () => {
    it('should be true when the selected channel is in loadingMoreChannelIds', () => {
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);
      const loadingMoreChannelIds = new Set([CHANNEL_ID]);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
          loadingMoreChannelIds,
        }),
      );

      expect(result.current.isLoadingMoreUploads).toBe(true);
    });

    it('should be false when no channel is selected or loading set is absent', () => {
      const loadingMoreChannelIds = new Set([CHANNEL_ID]);
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);

      const { result: noSelection } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: null,
          selectedChannel,
          loadingMoreChannelIds,
        }),
      );

      expect(noSelection.current.isLoadingMoreUploads).toBe(false);

      const { result: noLoadingSet } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
        }),
      );

      expect(noLoadingSet.current.isLoadingMoreUploads).toBe(false);
    });
  });

  describe('handleLoadMoreUploads', () => {
    it('should call onLoadMoreUploads with the effective selected channel id', () => {
      const onLoadMoreUploads = jest.fn();
      const selectedChannel = makeChannel(CHANNEL_LIST_UPLOAD_CAP);

      const { result } = renderHook(() =>
        useCachedUploadExpansion({
          effectiveSelectedChannelId: CHANNEL_ID,
          selectedChannel,
          onLoadMoreUploads,
        }),
      );

      act(() => {
        result.current.handleLoadMoreUploads();
      });

      expect(onLoadMoreUploads).toHaveBeenCalledTimes(1);
      expect(onLoadMoreUploads).toHaveBeenCalledWith(CHANNEL_ID);
    });
  });
});
