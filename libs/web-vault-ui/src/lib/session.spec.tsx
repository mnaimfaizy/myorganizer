/* eslint-disable import/first -- jest.mock must precede application imports */
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetCurrentUser = jest.fn();
const mockCreateVaultHandle = jest.fn();

jest.mock('@myorganizer/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@myorganizer/web-vault', () => ({
  createVaultHandle: (opts: unknown) => mockCreateVaultHandle(opts),
}));

import {
  useOptionalVaultSession,
  useVaultSession,
  VaultSessionProvider,
} from './session';

describe('VaultSessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(mockCreateVaultHandle).not.toHaveBeenCalled();
    expect(result.current.handle).toBeNull();
    expect(result.current.masterKeyBytes).toBeNull();
  });

  test('clears masterKeyBytes and updates handle when owner changes', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));

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
  });

  test('clears masterKeyBytes and nullifies handle when owner becomes undefined', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));

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
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));

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
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));

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
    mockCreateVaultHandle.mockImplementation((opts) => ({
      owner: opts.owner,
      masterKeyBytes: opts.masterKeyBytes,
    }));

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
});

describe('useVaultSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws error when called outside VaultSessionProvider', () => {
    // Suppress console.error during this test since renderHook will log the error
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useVaultSession());
    }).toThrow('useVaultSession must be used within VaultSessionProvider');

    consoleErrorSpy.mockRestore();
  });

  test('returns context value when called inside provider', () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-a' });
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
