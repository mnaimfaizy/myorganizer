/**
 * Tests for useLocalVaultRevision hook.
 *
 * The hook reads the Local Vault Revision via useSyncExternalStore, which
 * means it must handle both the case where a VaultSessionProvider is present
 * (and exposes a revision) and the case where it is not (returns a constant).
 *
 * ADR 0047, #587.
 */

import { act, renderHook } from '@testing-library/react';

import { createLocalVaultRevision } from '@myorganizer/web-vault';

import { useLocalVaultRevision } from './useLocalVaultRevision';
import { useOptionalVaultSession } from './session';

// Mock the session hook at module level
jest.mock('./session', () => {
  const actual = jest.requireActual('./session');
  return {
    ...actual,
    useOptionalVaultSession: jest.fn(),
  };
});

describe('useLocalVaultRevision', () => {
  beforeEach(() => {
    (useOptionalVaultSession as jest.Mock).mockReset();
  });

  describe('outside VaultSessionProvider (null session)', () => {
    it('returns constant when session is null', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useLocalVaultRevision());

      expect(result.current).toBe(0);
    });

    it('returns the same constant value on every render', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

      const { result, rerender } = renderHook(() => useLocalVaultRevision());

      const firstValue = result.current;
      rerender();
      const secondValue = result.current;

      expect(firstValue).toBe(secondValue);
      expect(firstValue).toBe(0);
    });
  });

  describe('inside VaultSessionProvider (with revision)', () => {
    it('returns current revision value from session', () => {
      const mockRevision = createLocalVaultRevision();

      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        revision: mockRevision,
        handle: null,
        syncQueue: null,
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
      });

      const { result } = renderHook(() => useLocalVaultRevision());

      // Initially at 0
      expect(result.current).toBe(0);
    });

    it('re-renders when revision bumps', async () => {
      const mockRevision = createLocalVaultRevision();

      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        revision: mockRevision,
        handle: null,
        syncQueue: null,
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
      });

      const { result } = renderHook(() => useLocalVaultRevision());

      expect(result.current).toBe(0);

      // Deliberately no manual `rerender()`. Forcing one would re-read the
      // snapshot and pass even if `subscribe` never notified React, which is
      // the one thing this test exists to prove.
      act(() => {
        mockRevision.bump();
      });

      expect(result.current).toBe(1);
    });

    it('handles multiple bumps', async () => {
      const mockRevision = createLocalVaultRevision();

      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        revision: mockRevision,
        handle: null,
        syncQueue: null,
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
      });

      const { result, rerender } = renderHook(() => useLocalVaultRevision());

      expect(result.current).toBe(0);

      mockRevision.bump();
      rerender();
      expect(result.current).toBe(1);

      mockRevision.bump();
      rerender();
      expect(result.current).toBe(2);

      mockRevision.bump();
      rerender();
      expect(result.current).toBe(3);
    });
  });

  describe('subscription lifecycle', () => {
    it('unsubscribes on unmount', () => {
      const mockRevision = createLocalVaultRevision();
      const subscribeSpy = jest.spyOn(mockRevision, 'subscribe');

      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        revision: mockRevision,
        handle: null,
        syncQueue: null,
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
      });

      const { unmount } = renderHook(() => useLocalVaultRevision());

      // Verify subscription was set up
      expect(subscribeSpy).toHaveBeenCalled();

      // Get the unsubscribe function that was returned
      const unsubscribeFn = subscribeSpy.mock.results[0].value;
      expect(typeof unsubscribeFn).toBe('function');

      unmount();

      // After unmount, bumps should not cause issues
      // (The hook no longer exists, so no warning should occur)
      expect(() => {
        mockRevision.bump();
      }).not.toThrow();
    });
  });

  describe('constant behavior when revision is null', () => {
    it('returns constant when session has no revision', () => {
      (useOptionalVaultSession as jest.Mock).mockReturnValue({
        revision: null,
        handle: null,
        syncQueue: null,
        masterKeyBytes: null,
        setMasterKeyBytes: jest.fn(),
        lock: jest.fn(),
      });

      const { result } = renderHook(() => useLocalVaultRevision());

      expect(result.current).toBe(0);
    });
  });
});
