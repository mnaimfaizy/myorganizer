/**
 * Tests for useVaultAbsentEvidence hook.
 *
 * Covers state transitions from checking to settled, retry on online event,
 * isolation across different owners, and cleanup on unmount. Mocks the vault
 * library's checkVaultAbsentEvidence and createVaultApi at the module boundary
 * to control settlement and error conditions.
 */

/* eslint-disable import/first -- jest.mock must precede application imports */

type AbsentEvidenceOptions = {
  api: { getVaultMeta: jest.Mock };
};

const mockCheckVaultAbsentEvidence = jest.fn<
  Promise<object>,
  [AbsentEvidenceOptions]
>();
const mockCreateVaultApi = jest.fn();

jest.mock('@myorganizer/web-vault', () => ({
  checkVaultAbsentEvidence: (options: AbsentEvidenceOptions) =>
    mockCheckVaultAbsentEvidence(options),
  createVaultApi: () => mockCreateVaultApi(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import type { VaultHandle } from '@myorganizer/web-vault';
import type { VaultAbsentEvidenceState } from './useVaultAbsentEvidence';
import { useVaultAbsentEvidence } from './useVaultAbsentEvidence';

/**
 * Helper to extract result from settled state without TypeScript errors.
 */
function getSettledResult(state: VaultAbsentEvidenceState): {
  kind: string;
  [key: string]: unknown;
} {
  if (state.status !== 'settled') {
    throw new Error(`Expected settled state, got ${state.status}`);
  }
  return state.result;
}

type MockHandle = Partial<VaultHandle> & { owner: string };

function createMockHandle(owner: string): MockHandle {
  return {
    owner,
    vaultStatus: jest.fn(() => 'absent'),
  };
}

describe('useVaultAbsentEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckVaultAbsentEvidence.mockClear();
    mockCreateVaultApi.mockClear();
  });

  test('starts with status "checking" and settles with the library result', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;
    const expectedResult = {
      kind: 'server-holds-vault',
      serverMeta: {} as any,
    };

    mockCheckVaultAbsentEvidence.mockResolvedValue(expectedResult);

    const { result } = renderHook(() => useVaultAbsentEvidence(handle));

    expect(result.current.status).toBe('checking');

    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    expect(result.current).toEqual({
      status: 'settled',
      result: expectedResult,
    });
  });

  test('stays checking when handle is null', async () => {
    const { result } = renderHook(() => useVaultAbsentEvidence(null));

    // When handle is null, it stays checking and never calls the server
    expect(result.current.status).toBe('checking');

    await waitFor(() => {
      expect(mockCheckVaultAbsentEvidence).not.toHaveBeenCalled();
    });
  });

  test('stays checking when vaultStatus is not absent', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;
    (handle.vaultStatus as jest.Mock).mockReturnValue('owned');

    const { result } = renderHook(() => useVaultAbsentEvidence(handle));

    // When status is not absent, it stays checking and never calls the server
    expect(result.current.status).toBe('checking');

    await waitFor(() => {
      expect(mockCheckVaultAbsentEvidence).not.toHaveBeenCalled();
    });
  });

  test('retries on online event when result is postponed', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    const deferred: {
      first: { resolve?: (val: any) => void };
      second: { resolve?: (val: any) => void };
    } = { first: {}, second: {} };

    mockCheckVaultAbsentEvidence
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            deferred.first.resolve = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            deferred.second.resolve = resolve;
          }),
      );

    const { result } = renderHook(() => useVaultAbsentEvidence(handle));

    // First call should be in progress
    expect(result.current.status).toBe('checking');

    // Resolve first with postponed
    deferred.first.resolve?.({ kind: 'postponed' });

    // Wait for first postponed
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('postponed');
    });

    // Dispatch online event to trigger retry
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Should have been called twice
    await waitFor(() => {
      expect(mockCheckVaultAbsentEvidence).toHaveBeenCalledTimes(2);
    });

    // Resolve second with no-server-vault
    deferred.second.resolve?.({ kind: 'no-server-vault' });

    // Should settle to no-server-vault
    await waitFor(() => {
      expect(getSettledResult(result.current).kind).toBe('no-server-vault');
    });
  });

  test('does not retry on online event when result is not postponed', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    mockCheckVaultAbsentEvidence.mockResolvedValue({
      kind: 'no-server-vault',
    });

    const { result } = renderHook(() => useVaultAbsentEvidence(handle));

    // Wait for settled
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('no-server-vault');
    });

    const callCount = mockCheckVaultAbsentEvidence.mock.calls.length;

    // Dispatch online event (microtasks are flushed by act)
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Should not have been called again
    expect(mockCheckVaultAbsentEvidence).toHaveBeenCalledTimes(callCount);
  });

  test('caught rejection settles as postponed without throwing', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    mockCheckVaultAbsentEvidence.mockRejectedValue(
      new Error('Unexpected error'),
    );

    const { result } = renderHook(() => useVaultAbsentEvidence(handle));

    // Wait for settled
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    // Should settle as postponed, not throw
    expect(result.current).toEqual({
      status: 'settled',
      result: { kind: 'postponed' },
    });
  });

  test('does not re-run when re-rendering with same owner but different handle object', async () => {
    const owner = 'user-1';
    const handle1 = createMockHandle(owner) as VaultHandle;

    mockCheckVaultAbsentEvidence.mockResolvedValue({
      kind: 'no-server-vault',
    });

    const { result, rerender } = renderHook((h) => useVaultAbsentEvidence(h), {
      initialProps: handle1,
    });

    // Wait for first settle
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    const firstCallCount = mockCheckVaultAbsentEvidence.mock.calls.length;

    // Rerender with different handle object but same owner
    const handle2 = createMockHandle(owner) as VaultHandle;
    rerender(handle2);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not have been called again
    expect(mockCheckVaultAbsentEvidence).toHaveBeenCalledTimes(firstCallCount);
  });

  test('resets to checking when re-rendering with different owner', async () => {
    const handle1 = createMockHandle('user-1') as VaultHandle;

    const results = [
      { kind: 'no-server-vault' as const },
      { kind: 'server-holds-vault' as const, serverMeta: {} as any },
    ];
    let callCount = 0;
    mockCheckVaultAbsentEvidence.mockImplementation(async () => {
      return results[callCount++] || results[results.length - 1];
    });

    const { result, rerender } = renderHook((h) => useVaultAbsentEvidence(h), {
      initialProps: handle1,
    });

    // Wait for first settle
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('no-server-vault');
    });

    // Rerender with different owner
    const handle2 = createMockHandle('user-2') as VaultHandle;
    rerender(handle2);

    // Should go back to checking
    await waitFor(() => {
      expect(result.current.status).toBe('checking');
    });

    // Then settle to new owner's result
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('server-holds-vault');
    });

    // Should have been called twice
    expect(mockCheckVaultAbsentEvidence).toHaveBeenCalledTimes(2);
  });

  test('does not warn or set state when unmounting before promise settles', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    // Never resolve
    mockCheckVaultAbsentEvidence.mockImplementation(
      () => new Promise(() => {}),
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { unmount } = renderHook(() => useVaultAbsentEvidence(handle));

    // Unmount immediately (before settle)
    unmount();

    // Wait a bit and check no warning
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
