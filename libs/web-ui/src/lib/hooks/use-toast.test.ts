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
  });

  it('should update a toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    act(() => {
      result.current.toast({ title: 'Updated Toast' });
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Updated Toast');
  });

  it('clears the list before the replacement toast is added', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    act(() => {
      result.current.toast({ title: 'Updated Toast' });
    });

    expect(result.current.toasts).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Updated Toast');
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

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(page.result.current.toasts).toHaveLength(1);
      expect(page.result.current.toasts[0].title).toBe('Import complete');

      expect(toaster.result.current.toasts).toHaveLength(1);
      expect(toaster.result.current.toasts[0].title).toBe('Import complete');
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
