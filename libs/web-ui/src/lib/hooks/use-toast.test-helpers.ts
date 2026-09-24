import { act, renderHook } from '@testing-library/react';
import { TOAST_REMOVE_DELAY, useToast } from './use-toast';

export { TOAST_REMOVE_DELAY };

export function clearToastState() {
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    jest.runOnlyPendingTimers();
  });
  act(() => {
    result.current.dismiss();
  });
  act(() => {
    jest.advanceTimersByTime(TOAST_REMOVE_DELAY);
  });
  unmount();
}
