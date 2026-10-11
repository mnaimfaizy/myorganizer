import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useOnlineStatus } from './use-online-status';

describe('useOnlineStatus', () => {
  let onlineSpy: jest.SpyInstance<boolean, []>;

  function setNavigatorOnline(value: boolean) {
    onlineSpy.mockReturnValue(value);
  }

  function dispatchBrowserEvent(type: 'online' | 'offline') {
    act(() => {
      window.dispatchEvent(new Event(type));
    });
  }

  beforeEach(() => {
    onlineSpy = jest
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports true when the browser reports a connection at mount', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it('reports false when the browser reports no connection at mount', () => {
    setNavigatorOnline(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it('follows the browser offline and online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    setNavigatorOnline(false);
    dispatchBrowserEvent('offline');
    expect(result.current).toBe(false);

    setNavigatorOnline(true);
    dispatchBrowserEvent('online');
    expect(result.current).toBe(true);
  });

  it('removes the same online and offline listeners it added on unmount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());

    const added = (type: string) =>
      addSpy.mock.calls.find(([eventType]) => eventType === type)?.[1];
    const onlineListener = added('online');
    const offlineListener = added('offline');
    expect(onlineListener).toBeDefined();
    expect(offlineListener).toBeDefined();

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', onlineListener);
    expect(removeSpy).toHaveBeenCalledWith('offline', offlineListener);
  });

  it('server render assumes a connection even when the browser reports none', () => {
    setNavigatorOnline(false);

    function Probe() {
      const online = useOnlineStatus();
      return <span>{online ? 'online' : 'offline'}</span>;
    }

    expect(renderToString(<Probe />)).toBe('<span>online</span>');
  });
});
