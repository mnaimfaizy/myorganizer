/* eslint-disable import/first -- jest.mock must precede application imports */
import { act, renderHook, waitFor } from '@testing-library/react';

const mockProbeVaultMetaReachability = jest.fn();
const mockCreateVaultApi = jest.fn();

jest.mock('@myorganizer/web-vault', () => ({
  probeVaultMetaReachability: (opts: unknown) =>
    mockProbeVaultMetaReachability(opts),
  createVaultApi: () => mockCreateVaultApi(),
}));

import { useServerReachability } from './useServerReachability';
import type { ServerReachability } from '@myorganizer/web-vault';

describe('useServerReachability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('probes once on mount and exposes null until first probe resolves', async () => {
    mockProbeVaultMetaReachability.mockImplementation(
      () =>
        new Promise((resolve) => {
          // Don't resolve immediately; we want to assert null state
          setTimeout(() => resolve('reachable'), 50);
        }),
    );

    const { result } = renderHook(() => useServerReachability());

    // On mount, reachability is null (probe in flight)
    expect(result.current.reachability).toBeNull();
    expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(1);

    // Wait for probe to resolve
    await waitFor(() => {
      expect(result.current.reachability).toBe('reachable');
    });
  });

  test('re-probes when window fires focus event', async () => {
    let resolveProbe: (value: ServerReachability) => void = () => {};
    mockProbeVaultMetaReachability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve as (value: ServerReachability) => void;
        }),
    );

    const { result } = renderHook(() => useServerReachability());

    // First probe
    expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(1);

    // Resolve first probe
    await act(async () => {
      resolveProbe('reachable');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.reachability).toBe('reachable');
    });

    // Simulate focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    // Should have triggered a second probe
    expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(2);
  });

  test('keeps previous reading on screen while re-probe is in flight (does not clear state to null)', async () => {
    let resolveProbe: (value: ServerReachability) => void = () => {};
    mockProbeVaultMetaReachability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve as (value: ServerReachability) => void;
        }),
    );

    const { result } = renderHook(() => useServerReachability());

    // First probe resolves with 'reachable'
    await act(async () => {
      resolveProbe('reachable');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.reachability).toBe('reachable');
    });

    // Set up second probe to hang
    let resolveProbe2: (value: ServerReachability) => void = () => {};
    mockProbeVaultMetaReachability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe2 = resolve as (value: ServerReachability) => void;
        }),
    );

    // Trigger focus (new probe starts, but doesn't resolve yet)
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    // Assert the previous reading is STILL on screen (not cleared to null)
    // This is key: a warning that blanks and reappears on every tab-return
    // is exactly when a User might press confirm.
    expect(result.current.reachability).toBe('reachable');

    // Now resolve the second probe with a different value
    await act(async () => {
      resolveProbe2('unreachable');
      await Promise.resolve();
    });

    // Now state updates to the new reading
    await waitFor(() => {
      expect(result.current.reachability).toBe('unreachable');
    });
  });

  test('recheck() triggers a fresh probe', async () => {
    mockProbeVaultMetaReachability.mockResolvedValue('reachable');

    const { result } = renderHook(() => useServerReachability());

    await waitFor(() => {
      expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.recheck();
    });

    await waitFor(() => {
      expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(2);
    });
  });

  test('removes focus listener on unmount', async () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    mockProbeVaultMetaReachability.mockResolvedValue('reachable');

    const { unmount } = renderHook(() => useServerReachability());

    await waitFor(() => {
      expect(mockProbeVaultMetaReachability).toHaveBeenCalled();
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'focus',
      expect.any(Function),
    );
    removeEventListenerSpy.mockRestore();
  });

  test('does not call setState after unmount (resolves probe after unmounting)', async () => {
    let resolveProbe: (value: ServerReachability) => void = () => {};
    mockProbeVaultMetaReachability.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve as (value: ServerReachability) => void;
        }),
    );

    const { result, unmount } = renderHook(() => useServerReachability());

    // Probe is in flight
    expect(result.current.reachability).toBeNull();

    // Unmount before probe resolves
    unmount();

    // Now resolve the probe — this should NOT cause a setState error/warning
    // The liveRef guard prevents the setState from happening
    await act(async () => {
      resolveProbe('reachable');
      await Promise.resolve();
    });

    // No act warning should have been thrown by the pending setState
  });

  test('provides recheck function that calls probe', async () => {
    mockProbeVaultMetaReachability.mockResolvedValue('unreachable');

    const { result } = renderHook(() => useServerReachability());

    await waitFor(() => {
      expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.recheck();
    });

    await waitFor(() => {
      expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(2);
    });
  });

  test('settles on unreachable when probeVaultMetaReachability rejects', async () => {
    mockProbeVaultMetaReachability.mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useServerReachability());

    expect(result.current.reachability).toBeNull();

    await waitFor(() => {
      expect(result.current.reachability).toBe('unreachable');
    });

    expect(mockProbeVaultMetaReachability).toHaveBeenCalledTimes(1);
  });

  test('settles on unreachable when createVaultApi throws synchronously', async () => {
    mockCreateVaultApi.mockImplementation(() => {
      throw new Error('Failed to create vault API');
    });

    const { result } = renderHook(() => useServerReachability());

    // The state may be null or unreachable depending on timing, but should
    // settle on unreachable after the async function executes
    await waitFor(() => {
      expect(result.current.reachability).toBe('unreachable');
    });

    expect(mockCreateVaultApi).toHaveBeenCalledTimes(1);
  });
});
