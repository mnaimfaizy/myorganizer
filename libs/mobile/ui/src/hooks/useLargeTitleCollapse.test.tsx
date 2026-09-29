import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import {
  LARGE_TITLE_COLLAPSE_OFFSET,
  useLargeTitleCollapse,
} from './useLargeTitleCollapse';

function scrolledTo(y: number): NativeSyntheticEvent<NativeScrollEvent> {
  return {
    nativeEvent: { contentOffset: { x: 0, y } },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

describe('useLargeTitleCollapse', () => {
  it('starts expanded', async () => {
    const { result } = await renderHook(() => useLargeTitleCollapse());
    expect(result.current.collapsed).toBe(false);
  });

  it('collapses once the scroll passes the title and expands again above it', async () => {
    const { result } = await renderHook(() => useLargeTitleCollapse());
    await act(() =>
      result.current.onScroll(scrolledTo(LARGE_TITLE_COLLAPSE_OFFSET + 1)),
    );
    expect(result.current.collapsed).toBe(true);
    await act(() => result.current.onScroll(scrolledTo(0)));
    expect(result.current.collapsed).toBe(false);
  });
});
