import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';
import type { YouTubeSyncStatus } from '../types';
import { useYouTubeSyncPoll } from './useYouTubeSyncPoll';

/**
 * Poll interval constant must match the implementation.
 * If POLL_INTERVAL_MS changes, these tests will break in the right way.
 */
const POLL_INTERVAL_MS = 2000;

describe('useYouTubeSyncPoll', () => {
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset document.hidden to false (default)
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    // Restore original descriptor
    if (originalHidden) {
      Object.defineProperty(document, 'hidden', originalHidden);
    } else {
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
      });
    }
  });

  function statusOf(
    overrides: Partial<YouTubeSyncStatus> = {},
  ): YouTubeSyncStatus {
    return {
      status: 'success',
      lastSyncedAt: null,
      lastSyncAttemptAt: null,
      lastSyncError: null,
      retryAt: null,
      channelStatus: 'never',
      channelLastAttemptAt: null,
      channelLastError: null,
      channelRetryAt: null,
      progress: null,
      ...overrides,
    };
  }

  describe('polling while live', () => {
    it('should call poll on mount when status is running', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);
    });

    it('should call poll on mount when status is discovering', () => {
      const poll = jest
        .fn()
        .mockResolvedValue(statusOf({ status: 'discovering' }));

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'discovering' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);
    });

    it('should continue polling every 2 seconds while running', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));
      const onRunComplete = jest.fn();

      renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll, onRunComplete }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      // Poll should be called on mount
      expect(poll).toHaveBeenCalledTimes(1);
      expect(onRunComplete).not.toHaveBeenCalled();

      // Advance one interval - should trigger another poll
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
      expect(onRunComplete).not.toHaveBeenCalled();
    });

    it('should continue polling while discovering', () => {
      const poll = jest
        .fn()
        .mockResolvedValue(statusOf({ status: 'discovering' }));

      renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll }),
        {
          initialProps: { status: statusOf({ status: 'discovering' }) },
        },
      );

      expect(poll).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
    });
  });

  describe('does not poll when terminal', () => {
    it.each([
      'success' as const,
      'partial' as const,
      'failed' as const,
      'quota_exceeded' as const,
      'cooldown' as const,
      'never' as const,
    ])('should not poll when status is %s', (status) => {
      const poll = jest.fn().mockResolvedValue(statusOf());

      renderHook(() => useYouTubeSyncPoll(statusOf({ status }), { poll }));

      expect(poll).not.toHaveBeenCalled();

      // Advance time and verify still no polling
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).not.toHaveBeenCalled();
    });

    it('should not poll when status is null', () => {
      const poll = jest.fn().mockResolvedValue(statusOf());

      renderHook(() => useYouTubeSyncPoll(null, { poll }));

      expect(poll).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).not.toHaveBeenCalled();
    });

    it('should not poll when status is undefined', () => {
      const poll = jest.fn().mockResolvedValue(statusOf());

      renderHook(() => useYouTubeSyncPoll(undefined, { poll }));

      expect(poll).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).not.toHaveBeenCalled();
    });
  });

  describe('transition to terminal state', () => {
    it('should stop polling and call onRunComplete exactly once on transition to terminal', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));
      const onRunComplete = jest.fn();

      const { rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll, onRunComplete }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      expect(poll).toHaveBeenCalledTimes(1);
      expect(onRunComplete).not.toHaveBeenCalled();

      // Transition to terminal state
      act(() => {
        rerender({ status: statusOf({ status: 'success' }) });
      });

      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Advance time and verify no more polls occur
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(1);

      // onRunComplete should still be 1
      expect(onRunComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onRunComplete only once on repeated re-renders after terminal', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));
      const onRunComplete = jest.fn();

      const { rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll, onRunComplete }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      // Transition to terminal
      act(() => {
        rerender({ status: statusOf({ status: 'partial' }) });
      });
      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Re-render again with same terminal status
      act(() => {
        rerender({ status: statusOf({ status: 'partial' }) });
      });
      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Re-render again
      act(() => {
        rerender({ status: statusOf({ status: 'partial' }) });
      });
      expect(onRunComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('no overlapping polls', () => {
    it('should await poll before scheduling the next timeout', () => {
      const poll = jest.fn();
      let resolveCurrentPoll: (() => void) | null = null;
      // Create a promise that won't resolve until we explicitly resolve it
      const pollPromise = new Promise<void>((resolve) => {
        resolveCurrentPoll = resolve;
      });
      poll.mockReturnValue(pollPromise);

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      // Poll called on mount
      expect(poll).toHaveBeenCalledTimes(1);

      // Advance time - the setTimeout fires and awaits poll()
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });

      // poll() was called from the setTimeout, but since it's still pending,
      // the next scheduleNextPoll() hasn't run yet
      expect(poll).toHaveBeenCalledTimes(2);

      // Advance time again while poll is still pending - should not cause another call
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });

      // poll should still be 2 because the first one is still pending
      expect(poll).toHaveBeenCalledTimes(2);

      // Now resolve the poll
      act(() => {
        resolveCurrentPoll?.();
      });

      // The scheduleNextPoll() should now run and schedule the next timeout
      // but poll won't be called again until that timeout fires
      expect(poll).toHaveBeenCalledTimes(2);
    });
  });

  describe('visibility changes', () => {
    it('should pause polling when tab becomes hidden', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Advance one interval
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);

      // Simulate tab becoming hidden
      act(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance time and verify no more polls
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
    });

    it('should resume polling immediately when tab becomes visible', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Advance one interval
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);

      // Simulate tab becoming hidden
      act(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);

      // Simulate tab becoming visible
      act(() => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should call poll immediately on visibility change
      expect(poll).toHaveBeenCalledTimes(3);

      // And then schedule the next poll after interval
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(4);
    });

    it('should not resume polling when tab becomes visible if run is no longer live', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      const { rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Simulate tab becoming hidden
      act(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Transition to terminal while hidden
      act(() => {
        rerender({ status: statusOf({ status: 'success' }) });
      });

      // Simulate tab becoming visible
      act(() => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not resume polling because run is no longer live
      expect(poll).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup on unmount', () => {
    it('should clear timers on unmount', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      const { unmount } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Advance one interval
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);

      // Unmount
      act(() => {
        unmount();
      });

      // Advance time and verify no more polls
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
    });

    it('should handle unmount while a poll is in flight', () => {
      const poll = jest.fn();
      let resolvePoll: (() => void) | null = null;
      const pollPromise = new Promise<void>((resolve) => {
        resolvePoll = resolve;
      });
      poll.mockReturnValue(pollPromise);

      const { unmount } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Advance to trigger next poll timeout
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });

      // Unmount while poll is in flight
      act(() => {
        unmount();
      });

      // Resolve the in-flight poll
      act(() => {
        resolvePoll?.();
      });

      // Advance time and verify no more polls are scheduled
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
    });
  });

  describe('no double chains on re-render', () => {
    it('should maintain single-poll-per-interval rate on multiple re-renders with same live status', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      const { rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      // Poll called on mount
      expect(poll).toHaveBeenCalledTimes(1);

      // Re-render with same status multiple times
      act(() => {
        rerender({ status: statusOf({ status: 'running' }) });
        rerender({ status: statusOf({ status: 'running' }) });
      });

      // poll should still be 1 because we just re-rendered with the same status
      expect(poll).toHaveBeenCalledTimes(1);

      // Advance one interval
      act(() => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
      });
      expect(poll).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should continue polling even if poll rejects', async () => {
      // A network blip that rejects poll() on one call should not kill the loop.
      // The hook's try-catch swallows the error and schedules the next poll.
      // This is the most likely failure mode in production (minutes-long run × 2s interval).
      let callCount = 0;
      const poll = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second call (from first timer fire) rejects — network blip
          return Promise.reject(new Error('network request failed'));
        }
        // Mount call and subsequent polls succeed
        return Promise.resolve(statusOf({ status: 'running' }));
      });

      renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'running' }), { poll }),
      );

      expect(poll).toHaveBeenCalledTimes(1);

      // Advance timer — poll is called inside the setTimeout, rejection created
      // within the try block and caught
      await act(async () => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
        // Flush microtasks to let the promise rejection settle inside the catch
        await Promise.resolve();
      });

      // Poll was called a second time (and rejected, but caught)
      expect(poll).toHaveBeenCalledTimes(2);

      // Advance another interval — polling should continue despite the rejection
      await act(async () => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS);
        await Promise.resolve();
      });

      // Poll should be called a third time, proving the loop didn't die
      expect(poll).toHaveBeenCalledTimes(3);
    });
  });

  describe('optional onRunComplete callback', () => {
    it('should handle undefined onRunComplete gracefully', () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));

      const { rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll }),
        {
          initialProps: { status: statusOf({ status: 'running' }) },
        },
      );

      // Transition to terminal without providing onRunComplete
      act(() => {
        rerender({ status: statusOf({ status: 'success' }) });
      });

      // Should not throw
      expect(poll).toHaveBeenCalledTimes(1);
    });
  });

  describe('user-initiated run (runUserSync)', () => {
    it('trigger resolves true with no live status → onRunComplete once', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const onRunComplete = jest.fn();
      const trigger = jest.fn().mockResolvedValue(true);

      const { result } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'success' }), {
          poll,
          onRunComplete,
        }),
      );

      // Call runUserSync with trigger
      await act(async () => {
        await result.current.runUserSync(trigger);
      });

      // onRunComplete should be called exactly once
      expect(onRunComplete).toHaveBeenCalledTimes(1);
      expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('live → terminal fires first then trigger resolves true → once total', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'running' }));
      const onRunComplete = jest.fn();
      const trigger = jest.fn().mockResolvedValue(true);

      const { result, rerender } = renderHook(
        ({ status }: { status: YouTubeSyncStatus | null }) =>
          useYouTubeSyncPoll(status, { poll, onRunComplete }),
        {
          initialProps: { status: statusOf({ status: 'success' }) },
        },
      );

      // Start runUserSync (but don't await yet)
      let syncPromise: Promise<void> | null = null;
      act(() => {
        syncPromise = result.current.runUserSync(trigger);
      });

      // Rerender with live status (poll path now running, triggers initial poll)
      act(() => {
        rerender({ status: statusOf({ status: 'running' }) });
      });
      expect(poll).toHaveBeenCalledTimes(1);
      expect(onRunComplete).not.toHaveBeenCalled();

      // Rerender to terminal (poll path fires onRunComplete)
      act(() => {
        rerender({ status: statusOf({ status: 'success' }) });
      });
      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Wait for the sync to complete
      await syncPromise;

      // Still exactly once (runUserSync's call is inert because poll path already fired)
      expect(onRunComplete).toHaveBeenCalledTimes(1);
    });

    it('stale: first runUserSync trigger (deferred) resolves after second runUserSync started → inert, second fires', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const onRunComplete = jest.fn();

      const { result } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'success' }), {
          poll,
          onRunComplete,
        }),
      );

      // First user-initiated run with deferred trigger
      let resolveFirst: ((value: boolean) => void) | null = null;
      const triggerFirst = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );

      // Start first sync (but don't await yet)
      let firstSyncPromise: Promise<void> | null = null;
      act(() => {
        firstSyncPromise = result.current.runUserSync(triggerFirst);
      });

      // Second user-initiated run (bumps run ID)
      const triggerSecond = jest.fn().mockResolvedValue(true);
      await act(async () => {
        await result.current.runUserSync(triggerSecond);
      });

      // onRunComplete fired once from second sync
      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Now resolve the first trigger — should be inert
      await act(async () => {
        resolveFirst?.(true);
        // Wait for the first sync to settle
        await firstSyncPromise;
      });

      // Still exactly once (first trigger was stale)
      expect(onRunComplete).toHaveBeenCalledTimes(1);
    });

    it('two sequential runUserSync calls with trigger resolving true fire onRunComplete twice', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const onRunComplete = jest.fn();

      const { result } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'success' }), {
          poll,
          onRunComplete,
        }),
      );

      // First run
      const trigger1 = jest.fn().mockResolvedValue(true);
      await act(async () => {
        await result.current.runUserSync(trigger1);
      });
      expect(onRunComplete).toHaveBeenCalledTimes(1);

      // Second run (guard resets on new runUserSync)
      const trigger2 = jest.fn().mockResolvedValue(true);
      await act(async () => {
        await result.current.runUserSync(trigger2);
      });
      expect(onRunComplete).toHaveBeenCalledTimes(2);
    });

    it('uses latest onRunComplete when option changes before trigger resolves', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const oldCallback = jest.fn();
      const newCallback = jest.fn();

      const { result, rerender } = renderHook(
        ({ onRunComplete }: { onRunComplete?: () => void }) =>
          useYouTubeSyncPoll(statusOf({ status: 'success' }), {
            poll,
            onRunComplete,
          }),
        {
          initialProps: { onRunComplete: oldCallback },
        },
      );

      let resolveTrigger: ((value: boolean) => void) | null = null;
      const trigger = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveTrigger = resolve;
          }),
      );

      // Start runUserSync with old callback (but don't await yet)
      let syncPromise: Promise<void> | null = null;
      act(() => {
        syncPromise = result.current.runUserSync(trigger);
      });

      // Change callback before trigger resolves
      act(() => {
        rerender({ onRunComplete: newCallback });
      });

      // Resolve the trigger and wait for sync to complete
      await act(async () => {
        resolveTrigger?.(true);
        await syncPromise;
      });

      expect(oldCallback).not.toHaveBeenCalled();
      expect(newCallback).toHaveBeenCalledTimes(1);
    });

    it('trigger resolves false → no call to onRunComplete', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const onRunComplete = jest.fn();
      const trigger = jest.fn().mockResolvedValue(false);

      const { result } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'success' }), {
          poll,
          onRunComplete,
        }),
      );

      await act(async () => {
        await result.current.runUserSync(trigger);
      });

      expect(onRunComplete).not.toHaveBeenCalled();
      expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('trigger rejects → runUserSync rejects and no call to onRunComplete', async () => {
      const poll = jest.fn().mockResolvedValue(statusOf({ status: 'success' }));
      const onRunComplete = jest.fn();
      const error = new Error('request failed');
      const trigger = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useYouTubeSyncPoll(statusOf({ status: 'success' }), {
          poll,
          onRunComplete,
        }),
      );

      let caughtError: Error | null = null;
      await act(async () => {
        try {
          await result.current.runUserSync(trigger);
        } catch (err) {
          caughtError = err as Error;
        }
      });

      expect(caughtError).toBe(error);
      expect(onRunComplete).not.toHaveBeenCalled();
      expect(trigger).toHaveBeenCalledTimes(1);
    });
  });
});
