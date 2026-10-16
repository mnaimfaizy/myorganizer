import { act, renderHook } from '@testing-library/react';
import { useRetryOnReconnect } from './use-retry-on-reconnect';

describe('useRetryOnReconnect', () => {
  function setVisibilityState(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
  }

  function dispatchOnlineEvent() {
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
  }

  function dispatchFocusEvent() {
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
  }

  function dispatchVisibilityChange() {
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  beforeEach(() => {
    setVisibilityState('visible');
  });

  afterEach(() => {
    setVisibilityState('visible');
  });

  it('calls retry when the browser comes back online while enabled', () => {
    const retry = jest.fn();
    renderHook(() => useRetryOnReconnect(true, retry));

    dispatchOnlineEvent();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('calls retry when the window regains focus while enabled', () => {
    const retry = jest.fn();
    renderHook(() => useRetryOnReconnect(true, retry));

    dispatchFocusEvent();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('calls retry when the tab becomes visible again while enabled', () => {
    const retry = jest.fn();
    renderHook(() => useRetryOnReconnect(true, retry));

    dispatchVisibilityChange();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('ignores a visibilitychange while the document is hidden', () => {
    const retry = jest.fn();
    renderHook(() => useRetryOnReconnect(true, retry));

    setVisibilityState('hidden');
    dispatchVisibilityChange();

    expect(retry).not.toHaveBeenCalled();
  });

  it('does not call retry on any event while disabled', () => {
    const retry = jest.fn();
    renderHook(() => useRetryOnReconnect(false, retry));

    dispatchOnlineEvent();
    dispatchFocusEvent();
    dispatchVisibilityChange();

    expect(retry).not.toHaveBeenCalled();
  });

  it('stops calling retry once enabled turns false', () => {
    const retry = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useRetryOnReconnect(enabled, retry),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    dispatchOnlineEvent();
    dispatchFocusEvent();
    dispatchVisibilityChange();

    expect(retry).not.toHaveBeenCalled();
  });

  it('stops calling retry after unmount', () => {
    const retry = jest.fn();
    const { unmount } = renderHook(() => useRetryOnReconnect(true, retry));

    unmount();
    dispatchOnlineEvent();
    dispatchFocusEvent();
    dispatchVisibilityChange();

    expect(retry).not.toHaveBeenCalled();
  });

  it('calls the latest retry callback after a rerender', () => {
    const firstRetry = jest.fn();
    const latestRetry = jest.fn();
    const { rerender } = renderHook(
      ({ retry }: { retry: () => void }) => useRetryOnReconnect(true, retry),
      { initialProps: { retry: firstRetry } },
    );

    rerender({ retry: latestRetry });
    dispatchFocusEvent();

    expect(firstRetry).not.toHaveBeenCalled();
    expect(latestRetry).toHaveBeenCalledTimes(1);
  });
});
