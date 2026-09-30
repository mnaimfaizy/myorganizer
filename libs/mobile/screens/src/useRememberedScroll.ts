import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  recallScrollOffset,
  rememberScrollOffset,
} from '@myorganizer/mobile/core';

/** What to spread onto the screen's `ScrollView` or `FlatList`. */
export interface RememberedScroll {
  contentOffset: { x: number; y: number };
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

/**
 * Keeps a scrolling screen where the User left it across a lock.
 *
 * An Auto-Lock unmounts the whole tab shell — that is what dropping the Master
 * Key costs, and keeping the tree mounted would leave decrypted records on
 * screens nobody is allowed to read. So the way back to where the User was is
 * to have written it down: the tab is the `lastTab` Device Setting the tab
 * navigator already reads, and the offset is this.
 *
 * The starting offset is captured once, on mount, rather than read per render:
 * `onScroll` overwrites the stored value continuously, so a live read would
 * chase itself.
 *
 * `contentOffset` rather than a ref and a `scrollTo` after layout: the prop is
 * applied by the native view as it is created, so the screen is never painted
 * at the top and then jumped. Where the platform ignores it the screen opens
 * at the top, which is exactly what it did before this existed.
 */
export function useRememberedScroll(key: string): RememberedScroll {
  const [initialOffset] = useState(() => recallScrollOffset(key));

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      rememberScrollOffset(key, event.nativeEvent.contentOffset.y);
    },
    [key],
  );

  return {
    contentOffset: { x: 0, y: initialOffset },
    onScroll,
    // 16ms — once a frame. The store is a `Map.set`, so the cost of the
    // handler is the bridge crossing, and a coarser throttle loses the last
    // stretch of a fast scroll.
    scrollEventThrottle: 16,
  };
}
