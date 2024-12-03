import { act, renderHook } from '@testing-library/react-hooks';
import { useToast } from './use-toast';

const TOAST_REMOVE_DELAY = 1000000;

describe('useToast', () => {
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
      const newToast = result.current.toast({ title: 'Test Toast' });
    });

    act(() => {
      result.current.toast({ title: 'Updated Toast' });
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

    expect(result.current.toasts).toHaveLength(1);
  });
});
