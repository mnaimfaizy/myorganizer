/* eslint-disable import/first -- jest.mock must precede application imports */
import { act, renderHook, waitFor } from '@testing-library/react';

const mockComputeVaultSyncStatus = jest.fn();

jest.mock('@myorganizer/web-vault', () => ({
  computeVaultSyncStatus: (opts: unknown) => mockComputeVaultSyncStatus(opts),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import type { VaultSyncStatus } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { useVaultSyncStatus } from './useVaultSyncStatus';

describe('useVaultSyncStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('without vault session, status is null and retry is no-op', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useVaultSyncStatus());

    expect(result.current.status).toBeNull();
    // Calling retry should not throw
    expect(() => result.current.retry()).not.toThrow();
    // Verify computeVaultSyncStatus was never called without a session
    expect(mockComputeVaultSyncStatus).not.toHaveBeenCalled();
  });

  test('with vault session having no handle, status is null', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: null,
      syncQueue: null,
    });

    const { result } = renderHook(() => useVaultSyncStatus());

    expect(result.current.status).toBeNull();
  });

  test('with vault session having handle and syncQueue, calls computeVaultSyncStatus on mount', async () => {
    const mockHandle = { owner: 'user-a' };
    const mockStatus: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    mockComputeVaultSyncStatus.mockResolvedValue(mockStatus);

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => jest.fn()),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { result } = renderHook(() => useVaultSyncStatus());
    // Flush the microtask `computeVaultSyncStatus(...).then(setStatus)`
    // schedules on mount, inside an active act scope — otherwise the state
    // update it produces lands after the synchronous mount's act scope has
    // already closed.
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(mockStatus);
    });

    expect(mockComputeVaultSyncStatus).toHaveBeenCalledWith({
      handle: mockHandle,
      queueStatus: { unsent: [], terminal: [] },
    });
  });

  test('calling syncQueue.subscribe listener triggers recompute', async () => {
    const mockHandle = { owner: 'user-a' };
    const initialStatus: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };
    const updatedStatus: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    const subscribedCallbacks: Array<() => void> = [];

    mockComputeVaultSyncStatus.mockImplementation(() => {
      // Return initial status on first call, updated on second
      return Promise.resolve(
        mockComputeVaultSyncStatus.mock.calls.length === 1
          ? initialStatus
          : updatedStatus,
      );
    });

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn((callback: () => void) => {
        subscribedCallbacks.push(callback);
        return jest.fn();
      }),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { result } = renderHook(() => useVaultSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(initialStatus);
    });

    expect(mockComputeVaultSyncStatus).toHaveBeenCalledTimes(1);

    // Simulate syncQueue notifying of a change
    await act(async () => {
      subscribedCallbacks[0]?.();
    });

    await waitFor(() => {
      expect(mockComputeVaultSyncStatus).toHaveBeenCalledTimes(2);
    });

    // Status should be updated
    await waitFor(() => {
      expect(result.current.status).toEqual(updatedStatus);
    });
  });

  test('unmount calls unsubscribe function from syncQueue.subscribe', async () => {
    const mockHandle = { owner: 'user-a' };
    const unsubscribe = jest.fn();

    mockComputeVaultSyncStatus.mockResolvedValue({
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    });

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => unsubscribe),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { unmount } = renderHook(() => useVaultSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('retry() calls syncQueue.retryNow with current handle', async () => {
    const mockHandle = { owner: 'user-a' };
    const mockRetryNow = jest.fn();

    mockComputeVaultSyncStatus.mockResolvedValue({
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    });

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => jest.fn()),
      retryNow: mockRetryNow,
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { result } = renderHook(() => useVaultSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.retry();
    });

    expect(mockRetryNow).toHaveBeenCalledWith(mockHandle);
  });

  test('retry() is no-op when handle is null', () => {
    const mockRetryNow = jest.fn();

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => jest.fn()),
      retryNow: mockRetryNow,
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: null,
      syncQueue: mockSyncQueue,
    });

    const { result } = renderHook(() => useVaultSyncStatus());

    act(() => {
      result.current.retry();
    });

    expect(mockRetryNow).not.toHaveBeenCalled();
  });

  test('status is masked to null when session ends (handle becomes null)', async () => {
    const mockHandle = { owner: 'user-a' };

    mockComputeVaultSyncStatus.mockResolvedValue({
      kind: 'pending',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    });

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => jest.fn()),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { rerender, result } = renderHook(() => useVaultSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.status).toBeDefined();
    });

    // Simulate sign-out: session becomes null
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    act(() => {
      rerender();
    });

    // Status should be masked to null even though the internal state remembers
    expect(result.current.status).toBeNull();
  });

  test('focus event listener calls recompute', async () => {
    const mockHandle = { owner: 'user-a' };

    mockComputeVaultSyncStatus.mockResolvedValue({
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    });

    const mockSyncQueue = {
      status: jest.fn(() => ({ unsent: [], terminal: [] })),
      subscribe: jest.fn(() => jest.fn()),
    };

    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      syncQueue: mockSyncQueue,
    });

    const { result } = renderHook(() => useVaultSyncStatus());
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.status).toBeDefined();
    });

    const initialCallCount = mockComputeVaultSyncStatus.mock.calls.length;

    // Simulate focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    // Should trigger another recompute
    await waitFor(() => {
      expect(mockComputeVaultSyncStatus.mock.calls.length).toBeGreaterThan(
        initialCallCount,
      );
    });
  });
});
