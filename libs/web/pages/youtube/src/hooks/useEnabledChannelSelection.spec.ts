import { renderHook, act } from '@testing-library/react';
import type { ChannelCarousel } from '../types';
import { useEnabledChannelSelection } from './useEnabledChannelSelection';

const makeChannel = (id: string, title: string): ChannelCarousel => ({
  channelId: id,
  channelTitle: title,
  channelThumbnail: null,
  videos: [],
});

describe('useEnabledChannelSelection', () => {
  describe('initial selection', () => {
    it('should leave both selection fields null when no Enabled Channels exist', () => {
      const { result } = renderHook(() =>
        useEnabledChannelSelection({ channels: [] }),
      );

      expect(result.current.effectiveSelectedChannelId).toBeNull();
      expect(result.current.selectedChannel).toBeNull();
    });

    it('should default to the first Enabled Channel when no initialChannelId is given', () => {
      const channels = [
        makeChannel('ch-alpha', 'Alpha Channel'),
        makeChannel('ch-beta', 'Beta Channel'),
      ];
      const { result } = renderHook(() =>
        useEnabledChannelSelection({ channels }),
      );

      expect(result.current.effectiveSelectedChannelId).toBe('ch-alpha');
      expect(result.current.selectedChannel).toEqual(channels[0]);
    });

    it('should select the deep-linked Enabled Channel when initialChannelId matches', () => {
      const channels = [
        makeChannel('ch-alpha', 'Alpha Channel'),
        makeChannel('ch-beta', 'Beta Channel'),
      ];
      const { result } = renderHook(() =>
        useEnabledChannelSelection({
          channels,
          initialChannelId: 'ch-beta',
        }),
      );

      expect(result.current.effectiveSelectedChannelId).toBe('ch-beta');
      expect(result.current.selectedChannel).toEqual(channels[1]);
    });

    it('should fall back to the first Enabled Channel when initialChannelId is unknown', () => {
      const channels = [
        makeChannel('ch-alpha', 'Alpha Channel'),
        makeChannel('ch-beta', 'Beta Channel'),
      ];
      const { result } = renderHook(() =>
        useEnabledChannelSelection({
          channels,
          initialChannelId: 'ch-disabled',
        }),
      );

      expect(result.current.effectiveSelectedChannelId).toBe('ch-alpha');
      expect(result.current.selectedChannel).toEqual(channels[0]);
    });
  });

  describe('selectChannel', () => {
    it('should select another Enabled Channel when the User picks one', () => {
      const channels = [
        makeChannel('ch-alpha', 'Alpha Channel'),
        makeChannel('ch-beta', 'Beta Channel'),
      ];
      const { result } = renderHook(() =>
        useEnabledChannelSelection({ channels }),
      );

      act(() => {
        result.current.selectChannel('ch-beta');
      });

      expect(result.current.effectiveSelectedChannelId).toBe('ch-beta');
      expect(result.current.selectedChannel).toEqual(channels[1]);
    });

    it('should fall back to the first remaining Enabled Channel when the picked channel is removed', () => {
      const channels = [
        makeChannel('ch-alpha', 'Alpha Channel'),
        makeChannel('ch-beta', 'Beta Channel'),
        makeChannel('ch-gamma', 'Gamma Channel'),
      ];
      const { result, rerender } = renderHook(
        ({ chs }: { chs: ChannelCarousel[] }) =>
          useEnabledChannelSelection({ channels: chs }),
        { initialProps: { chs: channels } },
      );

      act(() => {
        result.current.selectChannel('ch-beta');
      });

      expect(result.current.effectiveSelectedChannelId).toBe('ch-beta');

      rerender({
        chs: [channels[0], channels[2]],
      });

      expect(result.current.effectiveSelectedChannelId).toBe('ch-alpha');
      expect(result.current.selectedChannel).toEqual(channels[0]);
    });
  });
});
