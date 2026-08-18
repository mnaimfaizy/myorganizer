import { renderHook, act } from '@testing-library/react';
import type { YouTubeVideo } from '../types';
import { useVideoQueue, QUEUE_CAP } from './useVideoQueue';

describe('useVideoQueue', () => {
  const baseVideo = (id: string, watched = false): YouTubeVideo => ({
    id: `vid-${id}`,
    videoId: id,
    channelId: 'ch-1',
    title: `Video ${id}`,
    thumbnail: null,
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched,
  });

  describe('initial state', () => {
    it('should initialize with empty ids, items, null activeId, and focusSignal 0', () => {
      const { result } = renderHook(() => useVideoQueue([]));

      expect(result.current.ids).toEqual([]);
      expect(result.current.items).toEqual([]);
      expect(result.current.activeId).toBeNull();
      expect(result.current.current).toBeNull();
      expect(result.current.activeIndex).toBe(-1);
      expect(result.current.focusSignal).toBe(0);
      expect(result.current.isFull).toBe(false);
      expect(result.current.remainingSlots).toBe(4);
    });
  });

  describe('add', () => {
    it('should append a videoId to the queue', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      expect(result.current.ids).toEqual(['1']);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].videoId).toBe('1');
    });

    it('should append multiple videoIds in order', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });

      expect(result.current.ids).toEqual(['1', '2', '3']);
      expect(result.current.items).toHaveLength(3);
    });

    it('should not add duplicate videoId', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('1');
      });

      expect(result.current.ids).toEqual(['1']);
      expect(result.current.items).toHaveLength(1);
    });

    it('should not bump focusSignal when adding', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.add('1');
      });

      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should refuse add when queue is at QUEUE_CAP', () => {
      const videos = [
        baseVideo('1'),
        baseVideo('2'),
        baseVideo('3'),
        baseVideo('4'),
        baseVideo('5'),
      ];
      const { result } = renderHook(() => useVideoQueue(videos));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
        result.current.add('4');
      });

      expect(result.current.ids).toHaveLength(4);
      expect(result.current.isFull).toBe(true);
      expect(result.current.remainingSlots).toBe(0);

      act(() => {
        result.current.add('5');
      });

      // Should still be 4, not 5
      expect(result.current.ids).toHaveLength(4);
      expect(result.current.ids).toEqual(['1', '2', '3', '4']);
    });

    it('should not add when queue is full', () => {
      const library = Array.from({ length: 5 }, (_, i) =>
        baseVideo(String(i + 1)),
      );
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        for (let i = 1; i <= QUEUE_CAP; i++) {
          result.current.add(String(i));
        }
      });

      const beforeAdd = result.current.ids.length;
      act(() => {
        result.current.add('5');
      });

      expect(result.current.ids.length).toBe(beforeAdd);
    });
  });

  describe('isFull and remainingSlots', () => {
    it('should indicate full when at QUEUE_CAP', () => {
      const library = Array.from({ length: 4 }, (_, i) =>
        baseVideo(String(i + 1)),
      );
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        for (let i = 1; i <= 4; i++) {
          result.current.add(String(i));
        }
      });

      expect(result.current.isFull).toBe(true);
      expect(result.current.remainingSlots).toBe(0);
    });

    it('should show remaining slots below cap', () => {
      const library = Array.from({ length: 3 }, (_, i) =>
        baseVideo(String(i + 1)),
      );
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      expect(result.current.isFull).toBe(false);
      expect(result.current.remainingSlots).toBe(2);
    });
  });

  describe('library resolution', () => {
    it('should resolve ids against library on every render', () => {
      const library1 = [baseVideo('1', false)];
      const { result, rerender } = renderHook(
        ({ lib }: { lib: YouTubeVideo[] }) => useVideoQueue(lib),
        { initialProps: { lib: library1 } },
      );

      act(() => {
        result.current.add('1');
      });

      expect(result.current.items[0].watched).toBe(false);

      // Update library to mark video as watched
      const library2 = [baseVideo('1', true)];
      rerender({ lib: library2 });

      // Items should now reflect the updated watched state
      expect(result.current.items[0].watched).toBe(true);
    });

    it('should filter out ids not present in library', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(
        ({ lib }: { lib: YouTubeVideo[] }) => useVideoQueue(lib),
        { initialProps: { lib: library } },
      );

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3'); // This id is not in the library
      });

      // The ids array still has '3', but items filters it out
      expect(result.current.ids).toEqual(['1', '2', '3']);
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.map((v) => v.videoId)).toEqual(['1', '2']);
    });
  });

  describe('stop', () => {
    it('should clear the active pointer without emptying the queue', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.activeId).toBeNull();
      expect(result.current.current).toBeNull();
      expect(result.current.activeIndex).toBe(-1);
      // The rail keeps its order so the User can resume where they were.
      expect(result.current.ids).toEqual(['1', '2']);
    });

    it('should not bump focusSignal, because stopping is not a play', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });

      const signalWhilePlaying = result.current.focusSignal;

      act(() => {
        result.current.stop();
      });

      expect(result.current.focusSignal).toBe(signalWhilePlaying);
    });

    it('should be a no-op when nothing is playing', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.activeId).toBeNull();
      expect(result.current.ids).toEqual(['1']);
      expect(result.current.focusSignal).toBe(0);
    });

    it('should let playback resume after a stop', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      act(() => {
        result.current.stop();
      });

      act(() => {
        result.current.playId('2');
      });

      expect(result.current.activeId).toBe('2');
      expect(result.current.current).toEqual(library[1]);
    });
  });

  describe('playId', () => {
    it('should set activeId and bump focusSignal when videoId is queued', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.playId('1');
      });

      expect(result.current.activeId).toBe('1');
      expect(result.current.current).toEqual(library[0]);
      expect(result.current.activeIndex).toBe(0);
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });

    it('should be a no-op when videoId is not queued', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      const initialSignal = result.current.focusSignal;
      const initialActiveId = result.current.activeId;

      act(() => {
        result.current.playId('2'); // Not in queue
      });

      expect(result.current.activeId).toBe(initialActiveId);
      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should update current to the resolved video', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('2');
      });

      act(() => {
        result.current.playId('2');
      });

      expect(result.current.current).toBe(library[1]);
    });
  });

  describe('playNext', () => {
    it('should advance to the next unwatched video', () => {
      const library = [baseVideo('1', false), baseVideo('2', false)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.activeId).toBe('2');
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });

    it('should skip watched videos', () => {
      const library = [
        baseVideo('1', true),
        baseVideo('2', false),
        baseVideo('3', false),
      ];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });

      act(() => {
        result.current.playNext();
      });

      // Should skip '1' (watched) and land on '2' (unwatched)
      expect(result.current.activeId).toBe('2');
    });

    it('should wrap around to the beginning', () => {
      const library = [
        baseVideo('1', false),
        baseVideo('2', true),
        baseVideo('3', false),
      ];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
        result.current.playId('3');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      // Should wrap and find '1' at the beginning
      expect(result.current.activeId).toBe('1');
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });

    it('should be a no-op when nothing unwatched remains', () => {
      const library = [baseVideo('1', true), baseVideo('2', true)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      const initialSignal = result.current.focusSignal;
      const initialActiveId = result.current.activeId;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.activeId).toBe(initialActiveId);
      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should start playing from the first unwatched when nothing is active', () => {
      const library = [baseVideo('1', false), baseVideo('2', false)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.playNext();
      });

      expect(result.current.activeId).toBe('1');
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });
  });

  describe('completeAndNext', () => {
    it('should remove the video and advance to next unwatched', () => {
      const library = [baseVideo('1', false), baseVideo('2', false)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.completeAndNext('1');
      });

      expect(result.current.ids).toEqual(['2']);
      expect(result.current.activeId).toBe('2');
      expect(result.current.focusSignal).toBe(initialSignal + 1);
    });

    it('should not bump focusSignal when draining the queue', () => {
      const library = [baseVideo('1', false)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.completeAndNext('1');
      });

      expect(result.current.ids).toEqual([]);
      expect(result.current.activeId).toBeNull();
      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should be a no-op when videoId is not in queue', () => {
      const library = [baseVideo('1', false)];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      const initialSignal = result.current.focusSignal;
      const initialIds = result.current.ids;

      act(() => {
        result.current.completeAndNext('2');
      });

      expect(result.current.ids).toEqual(initialIds);
      expect(result.current.focusSignal).toBe(initialSignal);
    });
  });

  describe('moveUp and moveDown', () => {
    it('should move a video up in the queue', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });

      act(() => {
        result.current.moveUp('2');
      });

      expect(result.current.ids).toEqual(['2', '1', '3']);
    });

    it('should move a video down in the queue', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });

      act(() => {
        result.current.moveDown('2');
      });

      expect(result.current.ids).toEqual(['1', '3', '2']);
    });

    it('should not move up when at index 0', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      act(() => {
        result.current.moveUp('1');
      });

      expect(result.current.ids).toEqual(['1', '2']);
    });

    it('should not move down when at the last index', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      act(() => {
        result.current.moveDown('2');
      });

      expect(result.current.ids).toEqual(['1', '2']);
    });

    it('should not bump focusSignal when moving', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.moveUp('2');
        result.current.moveDown('1');
      });

      expect(result.current.focusSignal).toBe(initialSignal);
    });
  });

  describe('remove', () => {
    it('should remove a video from the queue', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });

      act(() => {
        result.current.remove('2');
      });

      expect(result.current.ids).toEqual(['1', '3']);
      expect(result.current.items).toHaveLength(2);
    });

    it('should clear activeId when removing the active video', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      act(() => {
        result.current.remove('1');
      });

      expect(result.current.activeId).toBeNull();
      expect(result.current.current).toBeNull();
    });

    it('should not affect activeId when removing a non-active video', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
        result.current.playId('1');
      });

      act(() => {
        result.current.remove('2');
      });

      expect(result.current.activeId).toBe('1');
      expect(result.current.current).toBe(library[0]);
    });

    it('should not bump focusSignal when removing', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.remove('1');
      });

      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should be a no-op when videoId is not in queue', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      const initialIds = result.current.ids;

      act(() => {
        result.current.remove('nonexistent');
      });

      expect(result.current.ids).toEqual(initialIds);
    });
  });

  describe('clear', () => {
    it('should empty the queue and clear activeId', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.ids).toEqual([]);
      expect(result.current.items).toEqual([]);
      expect(result.current.activeId).toBeNull();
      expect(result.current.current).toBeNull();
    });

    it('should not bump focusSignal when clearing', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.clear();
      });

      expect(result.current.focusSignal).toBe(initialSignal);
    });

    it('should be safe to clear an already empty queue', () => {
      const { result } = renderHook(() => useVideoQueue([]));

      const initialSignal = result.current.focusSignal;

      act(() => {
        result.current.clear();
      });

      expect(result.current.ids).toEqual([]);
      expect(result.current.focusSignal).toBe(initialSignal);
    });
  });

  describe('isQueued', () => {
    it('should return true for queued videoIds', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });

      expect(result.current.isQueued('1')).toBe(true);
      expect(result.current.isQueued('2')).toBe(true);
    });

    it('should return false for unqueued videoIds', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));

      act(() => {
        result.current.add('1');
      });

      expect(result.current.isQueued('2')).toBe(false);
      expect(result.current.isQueued('nonexistent')).toBe(false);
    });

    it('should return false for empty queue', () => {
      const { result } = renderHook(() => useVideoQueue([]));

      expect(result.current.isQueued('1')).toBe(false);
    });
  });
});
