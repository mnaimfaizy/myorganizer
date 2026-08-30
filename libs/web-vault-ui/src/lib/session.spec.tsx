/* eslint-disable import/first -- jest.mock must precede application imports */
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetCurrentUser = jest.fn();
const mockCreateVaultHandle = jest.fn();
const mockCreateVaultApi = jest.fn();
const mockCreateVaultSyncQueue = jest.fn();
const mockCreateLocalVaultRevision = jest.fn(() => ({
  current: () => 0,
  bump: jest.fn(),
  subscribe: () => () => undefined,
}));

jest.mock('@myorganizer/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@myorganizer/web-vault', () => ({
  createVaultHandle: (opts: unknown) => mockCreateVaultHandle(opts),
  createVaultApi: () => mockCreateVaultApi(),
  createVaultSyncQueue: (opts: unknown) => mockCreateVaultSyncQueue(opts),
  createLocalVaultRevision: () => mockCreateLocalVaultRevision(),
}));

import {
  useOptionalVaultSession,
  useVaultSession,
  VaultSessionProvider,
} from './session';

// Helper to read call arguments without exposing syncSink on the returned handle
const optionsOf = (call: number) =>
  mockCreateVaultHandle.mock.calls[call][0] as {
    owner: string;
    masterKeyBytes: Uint8Array | null;
    syncSink: unknown;
    revision: unknown;
  };

// Helper to set up distinct queues keyed on call order (order-independent)
const setupTwoQueueMock = (queueA: object, queueB: object) => {
  mockCreateVaultSyncQueue.mockImplementation(() => {
    const callIndex = mockCreateVaultSyncQueue.mock.calls.length - 1;
    return callIndex === 0 ? queueA : queueB;
  });
};

describe('VaultSessionProvider', () => {
  let mockApi: { getVaultBlob: jest.Mock; putVaultBlob: jest.Mock };
  let mockQueue: { vaultBlobChanged: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Standard mock setup used by most tests
    mockApi = { getVaultBlob: jest.fn(), putVaultBlob: jest.fn() };
    mockCreateVaultApi.mockReturnValue(mockApi);

    mockQueue = {
      vaultBlobChanged: jest.fn(),
      markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
    };
    mockCreateVaultSyncQueue.mockReturnValue(mockQueue);

    // Standard handle stub: just echoes back the input
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VaultSessionProvider>{children}</VaultSessionProvider>
  );

  test('constructs handle with signed-in owner on initial mount', () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
      __stub: true,
    }));

    const { result } = renderHook(() => useVaultSession(), { wrapper });

    expect(mockCreateVaultHandle).toHaveBeenCalledWith({
      owner: 'user-a',
      masterKeyBytes: null,
      syncSink: mockQueue,
      revision: expect.objectContaining({ subscribe: expect.any(Function) }),
    });
    expect(result.current.handle).toEqual({
      owner: 'user-a',
      masterKeyBytes: null,
      __stub: true,
    });
  });

  test('returns null handle and never calls createVaultHandle when no owner', () => {
    mockGetCurrentUser.mockReturnValue(undefined);

    const { result } = renderHook(() => useVaultSession(), { wrapper });

    expect(mockCreateVaultApi).not.toHaveBeenCalled();
    expect(mockCreateVaultSyncQueue).not.toHaveBeenCalled();
    expect(mockCreateVaultHandle).not.toHaveBeenCalled();
    expect(result.current.handle).toBeNull();
    expect(result.current.masterKeyBytes).toBeNull();
  });

  test('clears masterKeyBytes and updates handle when owner changes', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    const mockQueueA = {
      vaultBlobChanged: jest.fn(),
      markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
    };
    const mockQueueB = {
      vaultBlobChanged: jest.fn(),
      markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
    };
    setupTwoQueueMock(mockQueueA, mockQueueB);

    const { result, rerender } = renderHook(() => useVaultSession(), {
      wrapper,
    });

    // Set masterKeyBytes for user-a
    act(() => {
      result.current.setMasterKeyBytes(new Uint8Array([1, 2, 3]));
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toEqual(new Uint8Array([1, 2, 3]));
    });
    expect(result.current.handle).toEqual({
      owner: 'user-a',
      masterKeyBytes: new Uint8Array([1, 2, 3]),
    });
    expect(optionsOf(0).syncSink).toBe(mockQueueA);

    // Switch owner
    mockGetCurrentUser.mockReturnValue({ id: 'user-b' });
    rerender();

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toBeNull();
    });
    expect(result.current.handle).toEqual({
      owner: 'user-b',
      masterKeyBytes: null,
    });
    expect(optionsOf(2).syncSink).toBe(mockQueueB);
  });

  test('clears masterKeyBytes and nullifies handle when owner becomes undefined', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

    const { result, rerender } = renderHook(() => useVaultSession(), {
      wrapper,
    });

    // Set masterKeyBytes for user-a
    act(() => {
      result.current.setMasterKeyBytes(new Uint8Array([4, 5, 6]));
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toEqual(new Uint8Array([4, 5, 6]));
    });
    expect(result.current.handle).toEqual({
      owner: 'user-a',
      masterKeyBytes: new Uint8Array([4, 5, 6]),
    });

    // Sign out
    mockGetCurrentUser.mockReturnValue(undefined);
    rerender();

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toBeNull();
    });
    expect(result.current.handle).toBeNull();
  });

  test('does not spuriously clear masterKeyBytes on initial mount for same owner', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

    const { result } = renderHook(() => useVaultSession(), { wrapper });

    // Immediately set masterKeyBytes in the same render cycle
    act(() => {
      result.current.setMasterKeyBytes(new Uint8Array([7, 8, 9]));
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toEqual(new Uint8Array([7, 8, 9]));
    });
    expect(result.current.handle).toEqual({
      owner: 'user-a',
      masterKeyBytes: new Uint8Array([7, 8, 9]),
    });
  });

  test('lock() clears masterKeyBytes', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

    const { result } = renderHook(() => useVaultSession(), { wrapper });

    // Set masterKeyBytes
    act(() => {
      result.current.setMasterKeyBytes(new Uint8Array([10, 11, 12]));
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toEqual(
        new Uint8Array([10, 11, 12]),
      );
    });

    // Lock
    act(() => {
      result.current.lock();
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toBeNull();
    });
  });

  test('setMasterKeyBytes updates the masterKeyBytes state', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

    const { result } = renderHook(() => useVaultSession(), { wrapper });

    expect(result.current.masterKeyBytes).toBeNull();

    // Set bytes
    const testBytes = new Uint8Array([13, 14, 15]);
    act(() => {
      result.current.setMasterKeyBytes(testBytes);
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toEqual(testBytes);
    });

    // Clear bytes
    act(() => {
      result.current.setMasterKeyBytes(null);
    });

    await waitFor(() => {
      expect(result.current.masterKeyBytes).toBeNull();
    });
  });

  describe('sync sink wiring', () => {
    test('handle gets the queue (identity check)', () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
      mockCreateVaultHandle.mockImplementation(() => ({
        owner: 'user-a',
      }));

      renderHook(() => useVaultSession(), { wrapper });

      // Verify the exact object from createVaultSyncQueue is passed to createVaultHandle
      expect(optionsOf(0).syncSink).toBe(mockQueue);
    });

    test('queue is built from the vault api and a deferring prompt', () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
      mockCreateVaultHandle.mockImplementation(() => ({
        owner: 'user-a',
      }));

      renderHook(() => useVaultSession(), { wrapper });

      // Verify createVaultSyncQueue was called with the right api and prompt
      expect(mockCreateVaultSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          api: mockApi,
          prompt: expect.any(Function),
        }),
      );

      // Verify the prompt function returns 'defer'
      const callArgs = mockCreateVaultSyncQueue.mock.calls[0][0];
      expect(callArgs.prompt()).toBe('defer');
    });

    test('no owner, no api or queue', () => {
      mockGetCurrentUser.mockReturnValue(undefined);

      const { result } = renderHook(() => useVaultSession(), { wrapper });

      expect(mockCreateVaultApi).not.toHaveBeenCalled();
      expect(mockCreateVaultSyncQueue).not.toHaveBeenCalled();
      expect(result.current.handle).toBeNull();
    });

    test('markUnsentFromBookmarks is called with the handle on mount', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

      renderHook(() => useVaultSession(), { wrapper });

      await waitFor(() => {
        expect(mockQueue.markUnsentFromBookmarks).toHaveBeenCalledTimes(1);
      });

      // Verify it was called with the handle
      const callArg = (mockQueue.markUnsentFromBookmarks as jest.Mock).mock
        .calls[0][0];
      expect(callArg).toEqual({
        owner: 'user-a',
        masterKeyBytes: null,
      });
    });

    test('markUnsentFromBookmarks is not called when there is no owner', () => {
      mockGetCurrentUser.mockReturnValue(undefined);

      renderHook(() => useVaultSession(), { wrapper });

      expect(mockQueue.markUnsentFromBookmarks).not.toHaveBeenCalled();
    });

    test('markUnsentFromBookmarks is called again when handle changes on lock', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

      const { result } = renderHook(() => useVaultSession(), { wrapper });

      await waitFor(() => {
        expect(mockQueue.markUnsentFromBookmarks).toHaveBeenCalledTimes(1);
      });

      // Unlock by setting masterKeyBytes - this changes the handle identity
      act(() => {
        result.current.setMasterKeyBytes(new Uint8Array([1, 2, 3]));
      });

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toEqual(
          new Uint8Array([1, 2, 3]),
        );
      });

      // markUnsentFromBookmarks should be called again after handle changes for unlock
      expect(mockQueue.markUnsentFromBookmarks).toHaveBeenCalledTimes(2);

      // Lock - this changes the handle identity again
      act(() => {
        result.current.lock();
      });

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toBeNull();
      });

      // markUnsentFromBookmarks should be called again after lock (handle changed)
      expect(mockQueue.markUnsentFromBookmarks).toHaveBeenCalledTimes(3);

      // Verify the handle passed to the third call is the new locked one
      const thirdCallArg = (mockQueue.markUnsentFromBookmarks as jest.Mock).mock
        .calls[2][0];
      expect(thirdCallArg).toEqual({
        owner: 'user-a',
        masterKeyBytes: null,
      });
    });

    test('queue survives lock/unlock', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });

      const { result } = renderHook(() => useVaultSession(), { wrapper });

      // Set masterKeyBytes
      act(() => {
        result.current.setMasterKeyBytes(new Uint8Array([1, 2, 3]));
      });

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toEqual(
          new Uint8Array([1, 2, 3]),
        );
      });

      const firstSyncSink = optionsOf(0).syncSink;

      // Lock
      act(() => {
        result.current.lock();
      });

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toBeNull();
      });

      // Verify the queue was called exactly once despite multiple handle creations
      expect(mockCreateVaultSyncQueue).toHaveBeenCalledTimes(1);

      // Verify handle received the same queue reference after lock
      expect(optionsOf(1).syncSink).toBe(firstSyncSink);
    });

    test('owner change rebuilds the queue', async () => {
      mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
      const mockQueueA = {
        vaultBlobChanged: jest.fn(),
        markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
      };
      const mockQueueB = {
        vaultBlobChanged: jest.fn(),
        markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
      };
      setupTwoQueueMock(mockQueueA, mockQueueB);

      const { result, rerender } = renderHook(() => useVaultSession(), {
        wrapper,
      });

      // Set masterKeyBytes for user-a
      act(() => {
        result.current.setMasterKeyBytes(new Uint8Array([1, 2, 3]));
      });

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toEqual(
          new Uint8Array([1, 2, 3]),
        );
      });
      expect(optionsOf(0).syncSink).toBe(mockQueueA);

      // Switch owner
      mockGetCurrentUser.mockReturnValue({ id: 'user-b' });
      rerender();

      await waitFor(() => {
        expect(result.current.masterKeyBytes).toBeNull();
      });

      // Verify the queue was called twice and the new queue is used
      expect(mockCreateVaultSyncQueue).toHaveBeenCalledTimes(2);
      expect(optionsOf(2).syncSink).toBe(mockQueueB);
      expect(optionsOf(2).syncSink).not.toBe(mockQueueA);
    });
  });
});

describe('useVaultSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws error when called outside VaultSessionProvider', () => {
    // Suppress console.error during this test since renderHook will log the error
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useVaultSession());
    }).toThrow('useVaultSession must be used within VaultSessionProvider');

    consoleErrorSpy.mockRestore();
  });

  test('returns context value when called inside provider', () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    const mockApi = { getVaultBlob: jest.fn(), putVaultBlob: jest.fn() };
    mockCreateVaultApi.mockReturnValue(mockApi);
    const mockQueue = {
      vaultBlobChanged: jest.fn(),
      markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
    };
    mockCreateVaultSyncQueue.mockReturnValue(mockQueue);
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
    }));

    const { result } = renderHook(() => useVaultSession(), {
      wrapper: ({ children }) => (
        <VaultSessionProvider>{children}</VaultSessionProvider>
      ),
    });

    expect(result.current.masterKeyBytes).toBeNull();
    expect(result.current.handle).toEqual({ owner: 'user-a' });
    expect(typeof result.current.setMasterKeyBytes).toBe('function');
    expect(typeof result.current.lock).toBe('function');
  });
});

describe('useOptionalVaultSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when called outside VaultSessionProvider', () => {
    const { result } = renderHook(() => useOptionalVaultSession());

    expect(result.current).toBeNull();
  });

  test('returns context value when called inside provider', () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    const mockApi = { getVaultBlob: jest.fn(), putVaultBlob: jest.fn() };
    mockCreateVaultApi.mockReturnValue(mockApi);
    const mockQueue = {
      vaultBlobChanged: jest.fn(),
      markUnsentFromBookmarks: jest.fn().mockResolvedValue(undefined),
    };
    mockCreateVaultSyncQueue.mockReturnValue(mockQueue);
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
    }));

    const { result } = renderHook(() => useOptionalVaultSession(), {
      wrapper: ({ children }) => (
        <VaultSessionProvider>{children}</VaultSessionProvider>
      ),
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.masterKeyBytes).toBeNull();
    expect(result.current?.handle).toEqual({ owner: 'user-a' });
  });
});
