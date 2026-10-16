import { act, renderHook } from '@testing-library/react';
import { useRetryableCheck } from './use-retryable-check';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface CheckProps {
  check: () => Promise<string>;
  onResult: (result: string) => void;
}

describe('useRetryableCheck', () => {
  // Each check call records its own deferred so a test settles calls one at a time.
  let pending: Deferred<string>[];

  function createCheck() {
    return jest.fn(() => {
      const deferred = createDeferred<string>();
      pending.push(deferred);
      return deferred.promise;
    });
  }

  async function settle(index: number, value: string) {
    await act(async () => {
      pending[index].resolve(value);
    });
  }

  async function rejectAt(index: number, reason: unknown) {
    await act(async () => {
      pending[index].reject(reason);
    });
  }

  function renderCheckHook(retryOnReconnect = false) {
    const check = createCheck();
    const onResult = jest.fn();
    const rendered = renderHook(() =>
      useRetryableCheck(check, onResult, { retryOnReconnect }),
    );
    return { ...rendered, check, onResult };
  }

  function renderWithProps(initialProps: CheckProps) {
    return renderHook(
      (props: CheckProps) =>
        useRetryableCheck(props.check, props.onResult, {
          retryOnReconnect: false,
        }),
      { initialProps },
    );
  }

  beforeEach(() => {
    pending = [];
  });

  it('runs check once on mount and passes the settled result to onResult', async () => {
    const { result, check, onResult } = renderCheckHook();

    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.retrying).toBe(false);
    expect(onResult).not.toHaveBeenCalled();

    await settle(0, 'ready');

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('ready');
    expect(result.current.retrying).toBe(false);
  });

  it('retry re-runs check, reports retrying until it settles, then passes the new result to onResult', async () => {
    const { result, check, onResult } = renderCheckHook();
    await settle(0, 'first');

    act(() => {
      result.current.retry();
    });

    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.retrying).toBe(true);
    expect(onResult).toHaveBeenCalledTimes(1);

    await settle(1, 'second');

    expect(result.current.retrying).toBe(false);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith('second');
  });

  it('ignores retry while the mount check is still in flight', async () => {
    const { result, check, onResult } = renderCheckHook();

    act(() => {
      result.current.retry();
    });

    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.retrying).toBe(false);

    await settle(0, 'ready');

    expect(onResult).toHaveBeenCalledWith('ready');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('ignores a second retry while a retry is already in flight', async () => {
    const { result, check, onResult } = renderCheckHook();
    await settle(0, 'first');

    act(() => {
      result.current.retry();
    });
    act(() => {
      result.current.retry();
    });

    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.retrying).toBe(true);

    await settle(1, 'second');

    expect(check).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('does not call onResult when the check settles after unmount', async () => {
    const { unmount, check, onResult } = renderCheckHook();

    unmount();
    await settle(0, 'late');

    expect(check).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('treats a rejected mount check as settled with no result, then retry re-runs it', async () => {
    const { result, check, onResult } = renderCheckHook();

    await rejectAt(0, new Error('offline'));

    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.retrying).toBe(false);

    act(() => {
      result.current.retry();
    });

    expect(check).toHaveBeenCalledTimes(2);
    expect(result.current.retrying).toBe(true);

    await settle(1, 'recovered');

    expect(result.current.retrying).toBe(false);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('recovered');
  });

  it('clears retrying when a retry rejects, and a later retry runs the check again', async () => {
    const { result, check, onResult } = renderCheckHook();
    await settle(0, 'first');

    act(() => {
      result.current.retry();
    });
    expect(result.current.retrying).toBe(true);

    await rejectAt(1, new Error('timeout'));

    expect(result.current.retrying).toBe(false);
    expect(onResult).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    expect(check).toHaveBeenCalledTimes(3);
    expect(result.current.retrying).toBe(true);

    await settle(2, 'third');

    expect(result.current.retrying).toBe(false);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith('third');
  });

  it('neither calls onResult nor throws when a check rejects after unmount', async () => {
    const { unmount, check, onResult } = renderCheckHook();

    unmount();

    await expect(rejectAt(0, new Error('late'))).resolves.toBeUndefined();

    expect(check).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('uses the latest check and onResult after a rerender without re-running check', async () => {
    const firstCheck = createCheck();
    const firstOnResult = jest.fn();
    const latestCheck = createCheck();
    const latestOnResult = jest.fn();
    const { result, rerender } = renderWithProps({
      check: firstCheck,
      onResult: firstOnResult,
    });
    await settle(0, 'first');

    rerender({ check: latestCheck, onResult: latestOnResult });

    expect(latestCheck).not.toHaveBeenCalled();
    expect(firstOnResult).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    expect(firstCheck).toHaveBeenCalledTimes(1);
    expect(latestCheck).toHaveBeenCalledTimes(1);

    await settle(1, 'latest');

    expect(latestOnResult).toHaveBeenCalledWith('latest');
    expect(firstOnResult).toHaveBeenCalledTimes(1);
  });

  it('retries on window online and focus when retryOnReconnect is true', async () => {
    const { check } = renderCheckHook(true);
    await settle(0, 'first');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(check).toHaveBeenCalledTimes(2);
    await settle(1, 'second');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(check).toHaveBeenCalledTimes(3);
    await settle(2, 'third');
  });

  it('does not retry on window online or focus when retryOnReconnect is false', async () => {
    const { check } = renderCheckHook(false);
    await settle(0, 'first');

    act(() => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(check).toHaveBeenCalledTimes(1);
  });

  it('keeps retry identity stable across rerenders', () => {
    const { result, rerender } = renderWithProps({
      check: createCheck(),
      onResult: jest.fn(),
    });
    const firstRetry = result.current.retry;

    rerender({ check: createCheck(), onResult: jest.fn() });

    expect(result.current.retry).toBe(firstRetry);
  });
});
