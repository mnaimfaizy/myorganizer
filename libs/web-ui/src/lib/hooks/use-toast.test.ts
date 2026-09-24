import { act, renderHook } from '@testing-library/react';
import { useToast } from './use-toast';
import { clearToastState, TOAST_REMOVE_DELAY } from './use-toast.test-helpers';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearToastState();
    jest.useRealTimers();
  });

  it('should add a toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('adds a second toast sequentially with a new id while the first stays open', () => {
    const { result } = renderHook(() => useToast());

    let firstId: string | undefined;
    act(() => {
      firstId = result.current.toast({ title: 'Passphrase changed' }).id;
    });

    let secondId: string | undefined;
    act(() => {
      secondId = result.current.toast({ title: 'Import complete' }).id;
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(secondId).not.toBe(firstId);
    expect(result.current.toasts[0].title).toBe('Import complete');
    expect(result.current.toasts[0].open).toBe(true);
    expect(result.current.toasts[1].title).toBe('Passphrase changed');
    expect(result.current.toasts[1].open).toBe(true);
  });

  it('drops the oldest toast when a third is added', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'First' });
      result.current.toast({ title: 'Second' });
      result.current.toast({ title: 'Third' });
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].title).toBe('Third');
    expect(result.current.toasts[1].title).toBe('Second');
    expect(result.current.toasts.some((t) => t.title === 'First')).toBe(false);
  });

  it('should update a toast via update()', () => {
    const { result } = renderHook(() => useToast());

    let toastHandle: ReturnType<typeof result.current.toast> | undefined;
    act(() => {
      toastHandle = result.current.toast({ title: 'Test Toast' });
    });

    expect(toastHandle).toBeDefined();

    act(() => {
      toastHandle!.update({ title: 'Updated Toast' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(toastHandle!.id);
    expect(result.current.toasts[0].title).toBe('Updated Toast');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('replaces a dismissed toast with a new id without scheduling removal of the replacement', () => {
    const { result } = renderHook(() => useToast());

    let dismissedId: string | undefined;
    act(() => {
      dismissedId = result.current.toast({ title: 'Test Toast' }).id;
    });

    act(() => {
      result.current.dismiss(dismissedId);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].open).toBe(false);

    let replacementId: string | undefined;
    act(() => {
      replacementId = result.current.toast({ title: 'Updated Toast' }).id;
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(replacementId).toBeDefined();
    expect(replacementId).not.toBe(dismissedId);
    expect(
      result.current.toasts.find((t) => t.id === replacementId)?.title,
    ).toBe('Updated Toast');
    expect(
      result.current.toasts.find((t) => t.id === replacementId)?.open,
    ).toBe(true);
    expect(result.current.toasts.find((t) => t.id === dismissedId)?.open).toBe(
      false,
    );

    act(() => {
      jest.advanceTimersByTime(TOAST_REMOVE_DELAY);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Updated Toast');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('should dismiss a toast', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string | undefined;
    act(() => {
      const newToast = result.current.toast({ title: 'Test Toast' });
      toastId = newToast.id;
    });

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should remove a toast', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string | undefined;
    act(() => {
      const newToast = result.current.toast({ title: 'Test Toast' });
      toastId = newToast.id;
    });

    act(() => {
      result.current.dismiss(toastId);
    });

    act(() => {
      jest.advanceTimersByTime(TOAST_REMOVE_DELAY);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  describe('multi-subscriber delivery (#810)', () => {
    it('notifies both subscribers for the first toast', () => {
      const page = renderHook(() => useToast());
      const toaster = renderHook(() => useToast());

      act(() => {
        page.result.current.toast({ title: 'Passphrase changed' });
      });

      expect(page.result.current.toasts).toHaveLength(1);
      expect(page.result.current.toasts[0].title).toBe('Passphrase changed');
      expect(page.result.current.toasts[0].open).toBe(true);

      expect(toaster.result.current.toasts).toHaveLength(1);
      expect(toaster.result.current.toasts[0].title).toBe('Passphrase changed');
      expect(toaster.result.current.toasts[0].open).toBe(true);
    });

    it('notifies both subscribers for a sequential second toast', () => {
      const page = renderHook(() => useToast());
      const toaster = renderHook(() => useToast());

      act(() => {
        page.result.current.toast({ title: 'Passphrase changed' });
      });

      act(() => {
        toaster.result.current.toast({ title: 'Import complete' });
      });

      expect(page.result.current.toasts).toHaveLength(2);
      expect(page.result.current.toasts[0].title).toBe('Import complete');
      expect(page.result.current.toasts[1].title).toBe('Passphrase changed');

      expect(toaster.result.current.toasts).toHaveLength(2);
      expect(toaster.result.current.toasts[0].title).toBe('Import complete');
      expect(toaster.result.current.toasts[1].title).toBe('Passphrase changed');
    });

    it('notifies the remaining subscriber after the other unmounts', () => {
      const page = renderHook(() => useToast());
      const toaster = renderHook(() => useToast());

      page.unmount();

      act(() => {
        toaster.result.current.toast({ title: 'Import complete' });
      });

      expect(toaster.result.current.toasts).toHaveLength(1);
      expect(toaster.result.current.toasts[0].title).toBe('Import complete');
    });
  });
});
