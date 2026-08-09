import { renderHook, act } from '@testing-library/react';
import type { YouTubeVideo } from '../types';
import { useVideoQueue } from './useVideoQueue';

describe('useVideoQueue', () => {
  const baseVideo = (id: string): YouTubeVideo => ({
    id: `vid-${id}`,
    videoId: id,
    channelId: 'ch-1',
    title: `Video ${id}`,
    thumbnail: null,
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched: false,
  });

  describe('initial state', () => {
    it('should initialize with empty items, currentIndex -1, and focusSignal 0', () => {
      const { result } = renderHook(() => useVideoQueue());

      expect(result.current.items).toEqual([]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.current).toBeNull();
      expect(result.current.focusSignal).toBe(0);
    });
  });

  describe('add', () => {
    it('should append a new video to items', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
      });

      expect(result.current.items).toEqual([video]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.focusSignal).toBe(0);
    });

    it('should append multiple videos in order', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
      });

      expect(result.current.items).toEqual([video1, video2]);
    });

    it('should not add duplicate videoId', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
        result.current.add(video);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]).toEqual(video);
    });

    it('should not change currentIndex when adding', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.playAt(0);
      });

      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.add(video2);
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.current).toEqual(video1);
    });

    it('should not bump focusSignal when adding', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
      });

      expect(result.current.focusSignal).toBe(initialSignal);
    });
  });

  describe('playAt', () => {
    it('should set currentIndex and bump focusSignal when index is valid', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.playAt(1);
      });

      expect(result.current.currentIndex).toBe(1);
      expect(result.current.current).toEqual(video2);
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });

    it('should be a no-op when index is negative', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
      });

      const initialState = {
        index: result.current.currentIndex,
        signal: result.current.focusSignal,
        current: result.current.current,
      };

      act(() => {
        result.current.playAt(-1);
      });

      expect(result.current.currentIndex).toBe(initialState.index);
      expect(result.current.focusSignal).toBe(initialState.signal);
      expect(result.current.current).toBe(initialState.current);
    });

    it('should be a no-op when index is >= items.length', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
      });

      const initialState = {
        index: result.current.currentIndex,
        signal: result.current.focusSignal,
        current: result.current.current,
      };

      act(() => {
        result.current.playAt(1);
        result.current.playAt(10);
      });

      expect(result.current.currentIndex).toBe(initialState.index);
      expect(result.current.focusSignal).toBe(initialState.signal);
      expect(result.current.current).toBe(initialState.current);
    });

    it('should transition from one video to another', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(0);
      });

      expect(result.current.current).toEqual(video1);
      expect(result.current.focusSignal).toBe(1);

      act(() => {
        result.current.playAt(1);
      });

      expect(result.current.current).toEqual(video2);
      expect(result.current.focusSignal).toBe(2);
    });
  });

  describe('playNext', () => {
    it('should increment currentIndex and bump focusSignal when next item exists', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(0);
      });

      const previousIndex = result.current.currentIndex;
      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(previousIndex + 1);
      expect(result.current.current).toEqual(video2);
      expect(result.current.focusSignal).toBe(previousSignal + 1);
    });

    it('should be a no-op when at the last item', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(1);
      });

      const previousIndex = result.current.currentIndex;
      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(previousIndex);
      expect(result.current.focusSignal).toBe(previousSignal);
    });

    it('should be a no-op when queue is empty', () => {
      const { result } = renderHook(() => useVideoQueue());

      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.focusSignal).toBe(previousSignal);
    });

    it('should start playing from the first item when nothing is playing', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
      });

      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.current).toEqual(video1);
      expect(result.current.focusSignal).toBe(previousSignal + 1);
    });
  });

  describe('remove', () => {
    it('should remove an item before the current one and decrement currentIndex', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');
      const video3 = baseVideo('3');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.add(video3);
        result.current.playAt(2);
      });

      expect(result.current.current).toEqual(video3);
      expect(result.current.currentIndex).toBe(2);

      act(() => {
        result.current.remove('1');
      });

      expect(result.current.items).toEqual([video2, video3]);
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.current).toEqual(video3);
    });

    it('should remove the current item and stop playback', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(0);
      });

      expect(result.current.current).toEqual(video1);

      act(() => {
        result.current.remove('1');
      });

      expect(result.current.items).toEqual([video2]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.current).toBeNull();
    });

    it('should remove an item after the current one without changing currentIndex', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');
      const video3 = baseVideo('3');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.add(video3);
        result.current.playAt(0);
      });

      expect(result.current.current).toEqual(video1);
      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.remove('3');
      });

      expect(result.current.items).toEqual([video1, video2]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.current).toEqual(video1);
    });

    it('should not bump focusSignal when removing', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(1);
      });

      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.remove('1');
      });

      expect(result.current.focusSignal).toBe(previousSignal);
    });

    it('should be a no-op when videoId does not exist', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');

      act(() => {
        result.current.add(video1);
      });

      const previousState = {
        items: result.current.items,
        index: result.current.currentIndex,
      };

      act(() => {
        result.current.remove('nonexistent');
      });

      expect(result.current.items).toEqual(previousState.items);
      expect(result.current.currentIndex).toBe(previousState.index);
    });
  });

  describe('clear', () => {
    it('should empty items and reset currentIndex', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
        result.current.playAt(0);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.current).toBeNull();
    });

    it('should not bump focusSignal when clearing', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
        result.current.playAt(0);
      });

      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.clear();
      });

      expect(result.current.focusSignal).toBe(previousSignal);
    });

    it('should be safe to clear an already empty queue', () => {
      const { result } = renderHook(() => useVideoQueue());

      const previousSignal = result.current.focusSignal;

      act(() => {
        result.current.clear();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.currentIndex).toBe(-1);
      expect(result.current.focusSignal).toBe(previousSignal);
    });
  });

  describe('isQueued', () => {
    it('should return true for queued videoIds', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video1 = baseVideo('1');
      const video2 = baseVideo('2');

      act(() => {
        result.current.add(video1);
        result.current.add(video2);
      });

      expect(result.current.isQueued('1')).toBe(true);
      expect(result.current.isQueued('2')).toBe(true);
    });

    it('should return false for unqueued videoIds', () => {
      const { result } = renderHook(() => useVideoQueue());
      const video = baseVideo('1');

      act(() => {
        result.current.add(video);
      });

      expect(result.current.isQueued('nonexistent')).toBe(false);
      expect(result.current.isQueued('2')).toBe(false);
    });

    it('should return false for empty queue', () => {
      const { result } = renderHook(() => useVideoQueue());

      expect(result.current.isQueued('1')).toBe(false);
    });
  });
});
