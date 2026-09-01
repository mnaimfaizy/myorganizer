/**
 * Tests for useVaultClaimEvidence hook.
 *
 * Covers state transitions from checking to settled, retry on online event,
 * isolation across different owners, and cleanup on unmount. Mocks the vault
 * library's claimUnclaimedLocalVaultOnEvidence and createVaultApi at the module
 * boundary to control settlement and error conditions.
 */

/* eslint-disable import/first -- jest.mock must precede application imports */

type ClaimEvidenceOptions = {
  api: { getVaultMeta: jest.Mock };
  handle: object;
};

const mockClaimUnclaimedLocalVaultOnEvidence = jest.fn<
  Promise<object>,
  [ClaimEvidenceOptions]
>();
const mockCreateVaultApi = jest.fn();

jest.mock('@myorganizer/web-vault', () => ({
  claimUnclaimedLocalVaultOnEvidence: (options: ClaimEvidenceOptions) =>
    mockClaimUnclaimedLocalVaultOnEvidence(options),
  createVaultApi: () => mockCreateVaultApi(),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import type { VaultHandle } from '@myorganizer/web-vault';
import type { VaultClaimOnEvidenceResult } from '@myorganizer/web-vault';
import type { VaultClaimEvidenceState } from './useVaultClaimEvidence';
import { useVaultClaimEvidence } from './useVaultClaimEvidence';

/**
 * Helper to extract result from settled state without TypeScript errors.
 */
function getSettledResult(
  state: VaultClaimEvidenceState,
): VaultClaimOnEvidenceResult {
  if (state.status !== 'settled') {
    throw new Error(`Expected settled state, got ${state.status}`);
  }
  return state.result;
}

type MockHandle = Partial<VaultHandle> & { owner: string };

function createMockHandle(owner: string): MockHandle {
  return {
    owner,
  };
}

describe('useVaultClaimEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimUnclaimedLocalVaultOnEvidence.mockClear();
    mockCreateVaultApi.mockClear();
  });

  test('starts with status "checking" and settles with the library result', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;
    const expectedResult: VaultClaimOnEvidenceResult = {
      kind: 'claimed',
    };

    mockClaimUnclaimedLocalVaultOnEvidence.mockResolvedValue(expectedResult);

    const { result } = renderHook(() => useVaultClaimEvidence(handle));

    expect(result.current.status).toBe('checking');

    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    expect(result.current).toEqual({
      status: 'settled',
      result: expectedResult,
    });
  });

  test('settles with skipped-nothing-to-claim when handle is null', async () => {
    const { result } = renderHook(() => useVaultClaimEvidence(null));

    // When handle is null, it settles immediately without showing "checking" state
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    expect(result.current).toEqual({
      status: 'settled',
      result: { kind: 'skipped-nothing-to-claim' },
    });
  });

  test('retries on online event when result is postponed', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    // Use deferred promises with explicit resolve control instead of setTimeout
    const deferred: {
      first: { resolve?: (val: VaultClaimOnEvidenceResult) => void };
      second: { resolve?: (val: VaultClaimOnEvidenceResult) => void };
    } = { first: {}, second: {} };

    mockClaimUnclaimedLocalVaultOnEvidence
      .mockImplementationOnce(
        () =>
          new Promise<VaultClaimOnEvidenceResult>((resolve) => {
            deferred.first.resolve = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<VaultClaimOnEvidenceResult>((resolve) => {
            deferred.second.resolve = resolve;
          }),
      );

    const { result } = renderHook(() => useVaultClaimEvidence(handle));

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
      expect(mockClaimUnclaimedLocalVaultOnEvidence).toHaveBeenCalledTimes(2);
    });

    // Resolve second with claimed
    deferred.second.resolve?.({ kind: 'claimed' });

    // Should settle to claimed
    await waitFor(() => {
      expect(getSettledResult(result.current).kind).toBe('claimed');
    });
  });

  test('does not retry on online event when result is not postponed', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    mockClaimUnclaimedLocalVaultOnEvidence.mockResolvedValue({
      kind: 'claimed',
    });

    const { result } = renderHook(() => useVaultClaimEvidence(handle));

    // Wait for settled
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('claimed');
    });

    const callCount = mockClaimUnclaimedLocalVaultOnEvidence.mock.calls.length;

    // Dispatch online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Wait a bit to ensure no retry happens
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not have been called again
    expect(mockClaimUnclaimedLocalVaultOnEvidence).toHaveBeenCalledTimes(
      callCount,
    );
  });

  test('caught rejection settles as postponed without throwing', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    mockClaimUnclaimedLocalVaultOnEvidence.mockRejectedValue(
      new Error('Unexpected error'),
    );

    const { result } = renderHook(() => useVaultClaimEvidence(handle));

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

    mockClaimUnclaimedLocalVaultOnEvidence.mockResolvedValue({
      kind: 'claimed',
    });

    const { result, rerender } = renderHook((h) => useVaultClaimEvidence(h), {
      initialProps: handle1,
    });

    // Wait for first settle
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
    });

    const firstCallCount =
      mockClaimUnclaimedLocalVaultOnEvidence.mock.calls.length;

    // Rerender with different handle object but same owner
    const handle2 = createMockHandle(owner) as VaultHandle;
    rerender(handle2);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not have been called again
    expect(mockClaimUnclaimedLocalVaultOnEvidence).toHaveBeenCalledTimes(
      firstCallCount,
    );
  });

  test('re-runs when re-rendering with different owner', async () => {
    const handle1 = createMockHandle('user-1') as VaultHandle;

    const results = [
      { kind: 'claimed' as const },
      { kind: 'skipped-nothing-to-claim' as const },
    ];
    let callCount = 0;
    mockClaimUnclaimedLocalVaultOnEvidence.mockImplementation(async () => {
      return results[callCount++] || results[results.length - 1];
    });

    const { result, rerender } = renderHook((h) => useVaultClaimEvidence(h), {
      initialProps: handle1,
    });

    // Wait for first settle
    await waitFor(() => {
      expect(result.current.status).toBe('settled');
      expect(getSettledResult(result.current).kind).toBe('claimed');
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
      expect(getSettledResult(result.current).kind).toBe(
        'skipped-nothing-to-claim',
      );
    });

    // Should have been called twice
    expect(mockClaimUnclaimedLocalVaultOnEvidence).toHaveBeenCalledTimes(2);
  });

  test('does not warn or set state when unmounting before promise settles', async () => {
    const handle = createMockHandle('user-1') as VaultHandle;

    // Never resolve
    mockClaimUnclaimedLocalVaultOnEvidence.mockImplementation(
      () => new Promise(() => {}),
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { unmount } = renderHook(() => useVaultClaimEvidence(handle));

    // Unmount immediately (before settle)
    unmount();

    // Wait a bit and check no warning
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
