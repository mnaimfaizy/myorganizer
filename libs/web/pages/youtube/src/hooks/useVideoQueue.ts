'use client';

import { useCallback, useMemo, useState } from 'react';
import type { YouTubeVideo } from '../types';

export interface VideoQueue {
  /** Ordered Cached Uploads queued for this session. Never persisted. */
  items: YouTubeVideo[];
  /** Index of the queued upload currently playing, or -1 when nothing plays. */
  currentIndex: number;
  current: YouTubeVideo | null;
  /**
   * Increments only on an explicit play or a queue advance, never on add,
   * remove, clear, or a background sync refresh. Consumers move focus when
   * this changes so assistive tech follows the User's own action only.
   */
  focusSignal: number;
  add: (video: YouTubeVideo) => void;
  remove: (videoId: string) => void;
  playAt: (index: number) => void;
  playNext: () => void;
  clear: () => void;
  isQueued: (videoId: string) => boolean;
}

interface QueueState {
  items: YouTubeVideo[];
  currentIndex: number;
  focusSignal: number;
}

const INITIAL_STATE: QueueState = {
  items: [],
  currentIndex: -1,
  focusSignal: 0,
};

/**
 * In-session queue rail state for Cached Uploads.
 *
 * The queue lives for the lifetime of the page only — reloading or navigating
 * away drops it. Nothing here talks to the API, so a background sync refresh
 * can never reorder the queue or move focus.
 */
export function useVideoQueue(): VideoQueue {
  const [state, setState] = useState<QueueState>(INITIAL_STATE);

  const add = useCallback((video: YouTubeVideo) => {
    setState((prev) => {
      if (prev.items.some((item) => item.videoId === video.videoId)) {
        return prev;
      }
      return { ...prev, items: [...prev.items, video] };
    });
  }, []);

  const remove = useCallback((videoId: string) => {
    setState((prev) => {
      const index = prev.items.findIndex((item) => item.videoId === videoId);
      if (index === -1) return prev;

      const items = prev.items.filter((_, i) => i !== index);

      // Removing the upload that is playing stops playback rather than
      // sliding the next one in — an advance must stay explicit.
      let currentIndex = prev.currentIndex;
      if (index === prev.currentIndex) {
        currentIndex = -1;
      } else if (index < prev.currentIndex) {
        currentIndex = prev.currentIndex - 1;
      }

      return { ...prev, items, currentIndex };
    });
  }, []);

  const playAt = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.items.length) return prev;
      return {
        ...prev,
        currentIndex: index,
        focusSignal: prev.focusSignal + 1,
      };
    });
  }, []);

  const playNext = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.items.length) return prev;
      return {
        ...prev,
        currentIndex: nextIndex,
        focusSignal: prev.focusSignal + 1,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, items: [], currentIndex: -1 }));
  }, []);

  const isQueued = useCallback(
    (videoId: string) => state.items.some((item) => item.videoId === videoId),
    [state.items],
  );

  const current = useMemo(
    () => (state.currentIndex === -1 ? null : state.items[state.currentIndex]),
    [state.items, state.currentIndex],
  );

  // Memoized so consumers can depend on the queue object itself without
  // re-creating every handler on each render.
  return useMemo(
    () => ({
      items: state.items,
      currentIndex: state.currentIndex,
      current: current ?? null,
      focusSignal: state.focusSignal,
      add,
      remove,
      playAt,
      playNext,
      clear,
      isQueued,
    }),
    [
      state.items,
      state.currentIndex,
      state.focusSignal,
      current,
      add,
      remove,
      playAt,
      playNext,
      clear,
      isQueued,
    ],
  );
}
