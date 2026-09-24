import { act, renderHook } from '@testing-library/react';
import { useToast } from './use-toast';

export const TOAST_REMOVE_DELAY = 1000000;

export function clearToastState() {
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    result.current.dismiss();
  });
  act(() => {
    jest.advanceTimersByTime(TOAST_REMOVE_DELAY);
  });
  unmount();
}
