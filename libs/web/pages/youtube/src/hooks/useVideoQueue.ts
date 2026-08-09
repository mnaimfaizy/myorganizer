'use client';

import { useCallback, useMemo, useState } from 'react';
import type { YouTubeVideo } from '../types';

/**
 * Hard ceiling on the in-session queue, locked by the Variant B (Queue rail)
 * decision on issue #244. The cap is the anti-doomscroll guardrail, not a
 * performance limit — adding past it is refused rather than silently trimmed.
 */
export const QUEUE_CAP = 4;

export interface VideoQueue {
  /** Queued Cached Uploads, resolved against the library on every render. */
  items: YouTubeVideo[];
  /** Ordered Cached Upload ids — the authoritative queue order. */
  ids: string[];
  /** Cached Upload id currently playing, or null when nothing plays. */
  activeId: string | null;
  current: YouTubeVideo | null;
  /** Position of the active upload in `ids`, or -1 when nothing plays. */
  activeIndex: number;
  /**
   * Increments only on an explicit play or a queue advance, never on add,
   * remove, reorder, clear, or a background sync refresh. Consumers move
   * focus when this changes so assistive tech follows the User's own action.
   */
  focusSignal: number;
  isFull: boolean;
  remainingSlots: number;
  isQueued: (videoId: string) => boolean;
  add: (videoId: string) => void;
  remove: (videoId: string) => void;
  moveUp: (videoId: string) => void;
  moveDown: (videoId: string) => void;
  clear: () => void;
  playId: (videoId: string) => void;
  playNext: () => void;
  completeAndNext: (videoId: string) => void;
}

interface QueueState {
  ids: string[];
  activeId: string | null;
  focusSignal: number;
}

const INITIAL_STATE: QueueState = {
  ids: [],
  activeId: null,
  focusSignal: 0,
};

/**
 * Finds the next not-yet-Watched upload after `afterId`, wrapping to the front
 * so a queue built out of order still drains. Returns null when everything
 * remaining is already Watched.
 */
function nextUnwatchedId(
  ids: string[],
  afterId: string | null,
  isWatched: (videoId: string) => boolean,
): string | null {
  const start = afterId ? ids.indexOf(afterId) + 1 : 0;
  for (let i = start; i < ids.length; i++) {
    if (!isWatched(ids[i])) return ids[i];
  }
  for (let i = 0; i < Math.max(start - 1, 0); i++) {
    if (!isWatched(ids[i])) return ids[i];
  }
  return null;
}

/**
 * In-session queue rail state for Cached Uploads, per the locked Variant B
 * model (issue #244): an ordered list of Cached Upload ids with an active
 * pointer, capped at {@link QUEUE_CAP}.
 *
 * The queue stores ids and resolves them against `library` on every render, so
 * a Watched toggle or a sync refresh that replaces the library is reflected
 * immediately rather than being frozen at the moment of queueing. Nothing here
 * talks to the API, so a background sync can never reorder the queue or move
 * focus.
 *
 * The queue lives for the lifetime of the page only — reloading or navigating
 * away drops it.
 */
export function useVideoQueue(library: YouTubeVideo[]): VideoQueue {
  const [state, setState] = useState<QueueState>(INITIAL_STATE);

  const libraryById = useMemo(
    () => new Map(library.map((video) => [video.videoId, video])),
    [library],
  );

  const isWatched = useCallback(
    (videoId: string) => !!libraryById.get(videoId)?.watched,
    [libraryById],
  );

  const items = useMemo(
    () =>
      state.ids
        .map((id) => libraryById.get(id))
        .filter((video): video is YouTubeVideo => video !== undefined),
    [state.ids, libraryById],
  );

  const add = useCallback((videoId: string) => {
    setState((prev) => {
      if (prev.ids.length >= QUEUE_CAP || prev.ids.includes(videoId)) {
        return prev;
      }
      return { ...prev, ids: [...prev.ids, videoId] };
    });
  }, []);

  const remove = useCallback((videoId: string) => {
    setState((prev) => {
      if (!prev.ids.includes(videoId)) return prev;
      const ids = prev.ids.filter((id) => id !== videoId);
      // Removing the upload that is playing stops playback rather than
      // sliding the next one in — an advance must stay explicit so assistive
      // tech is never dropped into a different upload without asking.
      const activeId = prev.activeId === videoId ? null : prev.activeId;
      return { ...prev, ids, activeId };
    });
  }, []);

  const moveUp = useCallback((videoId: string) => {
    setState((prev) => {
      const index = prev.ids.indexOf(videoId);
      if (index <= 0) return prev;
      const ids = [...prev.ids];
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      return { ...prev, ids };
    });
  }, []);

  const moveDown = useCallback((videoId: string) => {
    setState((prev) => {
      const index = prev.ids.indexOf(videoId);
      if (index < 0 || index >= prev.ids.length - 1) return prev;
      const ids = [...prev.ids];
      [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
      return { ...prev, ids };
    });
  }, []);

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, ids: [], activeId: null }));
  }, []);

  const playId = useCallback((videoId: string) => {
    setState((prev) => {
      if (!prev.ids.includes(videoId)) return prev;
      return {
        ...prev,
        activeId: videoId,
        focusSignal: prev.focusSignal + 1,
      };
    });
  }, []);

  const playNext = useCallback(() => {
    setState((prev) => {
      const next = nextUnwatchedId(prev.ids, prev.activeId, isWatched);
      if (!next || next === prev.activeId) return prev;
      return {
        ...prev,
        activeId: next,
        focusSignal: prev.focusSignal + 1,
      };
    });
  }, [isWatched]);

  const completeAndNext = useCallback(
    (videoId: string) => {
      setState((prev) => {
        if (!prev.ids.includes(videoId)) return prev;
        // A finished upload leaves the queue, so the rail drains as the
        // session proceeds and the cap keeps meaning something.
        const ids = prev.ids.filter((id) => id !== videoId);
        const next = nextUnwatchedId(ids, null, isWatched);
        return {
          ids,
          activeId: next,
          // Advancing to a new upload is a queue advance, so focus follows;
          // draining the queue empty focuses nothing and must not signal.
          focusSignal: next ? prev.focusSignal + 1 : prev.focusSignal,
        };
      });
    },
    [isWatched],
  );

  const isQueued = useCallback(
    (videoId: string) => state.ids.includes(videoId),
    [state.ids],
  );

  const current = useMemo(
    () => (state.activeId ? (libraryById.get(state.activeId) ?? null) : null),
    [state.activeId, libraryById],
  );

  const activeIndex = state.activeId ? state.ids.indexOf(state.activeId) : -1;

  // Memoized so consumers can depend on the queue object itself without
  // re-creating every handler on each render.
  return useMemo(
    () => ({
      items,
      ids: state.ids,
      activeId: state.activeId,
      current,
      activeIndex,
      focusSignal: state.focusSignal,
      isFull: state.ids.length >= QUEUE_CAP,
      remainingSlots: Math.max(0, QUEUE_CAP - state.ids.length),
      isQueued,
      add,
      remove,
      moveUp,
      moveDown,
      clear,
      playId,
      playNext,
      completeAndNext,
    }),
    [
      items,
      state.ids,
      state.activeId,
      state.focusSignal,
      current,
      activeIndex,
      isQueued,
      add,
      remove,
      moveUp,
      moveDown,
      clear,
      playId,
      playNext,
      completeAndNext,
    ],
  );
}
