// The dismissal store is module-level state (the cached flag and its listeners),
// so every test loads a fresh module graph. React and Testing Library are loaded
// from that same graph, so the hook and the renderer share one React.
//
// Testing Library's auto-cleanup would register an afterEach from inside a
// running test when it is re-evaluated, so cleanup runs explicitly in afterEach.
import '@testing-library/jest-dom';

process.env.RTL_SKIP_AUTO_CLEANUP = 'true';

type Rtl = typeof import('@testing-library/react');
type DismissedHookModule = typeof import('./use-install-card-dismissed');

const DISMISSED_KEY = 'myorganiser.install-card.dismissed.v1';

let loadedRtl: Rtl | null = null;

async function loadHook(): Promise<{
  rtl: Rtl;
  useInstallCardDismissed: DismissedHookModule['useInstallCardDismissed'];
}> {
  jest.resetModules();
  const rtl = await import('@testing-library/react');
  loadedRtl = rtl;
  const { useInstallCardDismissed } =
    await import('./use-install-card-dismissed');
  return { rtl, useInstallCardDismissed };
}

describe('useInstallCardDismissed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    loadedRtl?.cleanup();
    loadedRtl = null;
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('should start not dismissed, and share the dismissal with every mounted consumer and persist it when dismiss is called', async () => {
    const { rtl, useInstallCardDismissed } = await loadHook();
    const first = rtl.renderHook(() => useInstallCardDismissed());
    const second = rtl.renderHook(() => useInstallCardDismissed());
    expect(first.result.current.dismissed).toBe(false);

    rtl.act(() => {
      first.result.current.dismiss();
    });

    expect(first.result.current.dismissed).toBe(true);
    expect(second.result.current.dismissed).toBe(true);
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
  });

  it('should start dismissed in a fresh module when a previous visit stored the dismissal', async () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    const { rtl, useInstallCardDismissed } = await loadHook();

    const { result } = rtl.renderHook(() => useInstallCardDismissed());

    expect(result.current.dismissed).toBe(true);
  });

  it('should not throw and should stay dismissed for the session when storage writes fail', async () => {
    const { rtl, useInstallCardDismissed } = await loadHook();
    const { result } = rtl.renderHook(() => useInstallCardDismissed());
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    expect(() =>
      rtl.act(() => {
        result.current.dismiss();
      }),
    ).not.toThrow();
    expect(setItemSpy).toHaveBeenCalledWith(DISMISSED_KEY, 'true');
    expect(result.current.dismissed).toBe(true);
  });

  it('should start not dismissed without throwing when storage reads fail', async () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    const { rtl, useInstallCardDismissed } = await loadHook();

    const { result } = rtl.renderHook(() => useInstallCardDismissed());

    expect(getItemSpy).toHaveBeenCalledWith(DISMISSED_KEY);
    expect(result.current.dismissed).toBe(false);
  });
});
