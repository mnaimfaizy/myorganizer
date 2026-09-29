import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * How far a screen scrolls before its large title collapses: the display
 * title's own line height plus the gap under it, i.e. the point where the
 * large title would have scrolled out from under the action row.
 */
export const LARGE_TITLE_COLLAPSE_OFFSET = 48;

/**
 * Drives `LargeTitleHeader`'s collapsed state from a scroll view.
 *
 * ```tsx
 * const titleCollapse = useLargeTitleCollapse();
 * <TabScreenHeader title="Tasks" collapsed={titleCollapse.collapsed} />
 * <ScrollView
 *   onScroll={titleCollapse.onScroll}
 *   scrollEventThrottle={titleCollapse.scrollEventThrottle}
 * />
 * ```
 *
 * It re-renders only when the offset crosses the threshold, not on every
 * scroll event, so wiring it costs a screen two renders per crossing.
 */
export function useLargeTitleCollapse(
  threshold: number = LARGE_TITLE_COLLAPSE_OFFSET,
): {
  collapsed: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
} {
  const [collapsed, setCollapsed] = useState(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const next = event.nativeEvent.contentOffset.y > threshold;
      setCollapsed((current) => (current === next ? current : next));
    },
    [threshold],
  );

  return { collapsed, onScroll, scrollEventThrottle: 16 };
}
