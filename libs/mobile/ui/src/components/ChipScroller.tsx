import React, { useCallback, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type FocusEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTheme } from '../useTheme';
import { FOCUS_RING_OUTSET } from '../hooks/useFocusRing';

/**
 * Where a scroller has to be so the span `start`–`end` of its content is in
 * view with `margin` to spare on both sides. Returns `offset` unchanged when
 * it already is, or when the scroller has not been measured yet.
 */
export function revealOffset({
  start,
  end,
  offset,
  viewport,
  margin,
}: {
  /** The near and far edge of the span, in content coordinates. */
  start: number;
  end: number;
  /** Where the scroller is now. */
  offset: number;
  /** How much of the content the scroller shows at once. */
  viewport: number;
  margin: number;
}): number {
  if (viewport <= 0) return offset;
  if (start - margin < offset) return Math.max(0, start - margin);
  if (end + margin > offset + viewport) return end + margin - viewport;
  return offset;
}

export interface ChipScrollerProps {
  /** The chips, in reading order. */
  children: React.ReactNode;
}

/**
 * One row of chips that scrolls sideways when it is wider than the screen —
 * the Tasks composer's.
 *
 * A scroller clips what it holds, and a chip's focus ring is drawn outside
 * the chip, so in a plain horizontal `ScrollView` the ring lost its top and
 * bottom, and its far side too on a chip Android had scrolled flush to the
 * scroller's edge (#1052). Two things give the ring its room:
 *
 * - **Above and below**, the content is padded by the ring's reach and the
 *   scroller is pulled back out by the same amount, so the row takes exactly
 *   the height it did and nothing around it moves.
 * - **Sideways**, a chip taking focus is scrolled in by the row's own inset.
 *   Android brings a focused view just inside the scroller and no further;
 *   this takes it the rest of the way, so the first and last chip come to
 *   rest where they sit when the row is at either end.
 *
 * Touch never focuses a chip, so a touch User sees neither.
 */
export function ChipScroller({
  children,
}: ChipScrollerProps): React.JSX.Element {
  const theme = useTheme();
  const inset = theme.spacing.md;

  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const content = useRef<React.ComponentRef<typeof View>>(null);
  // Kept from the scroller's own events: React Native has no way to ask a
  // scroller where it is.
  const offset = useRef(0);
  const viewport = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.x;
    },
    [],
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.width;
  }, []);

  // Focus bubbles, so the row hears it from whichever chip took it.
  const onFocus = useCallback(
    (event: FocusEvent) => {
      const row = content.current;
      const chip = event.target;
      // The legacy renderer names a number instead, which cannot be measured.
      if (row === null || chip == null || typeof chip === 'number') return;
      chip.measureLayout(row, (x, _y, width) => {
        const to = revealOffset({
          start: x,
          end: x + width,
          offset: offset.current,
          viewport: viewport.current,
          margin: inset,
        });
        if (to === offset.current) return;
        offset.current = to;
        scroller.current?.scrollTo({ x: to, animated: false });
      });
    },
    [inset],
  );

  return (
    <ScrollView
      ref={scroller}
      testID="chip-scroller"
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      onScroll={onScroll}
      onScrollEndDrag={onScroll}
      onMomentumScrollEnd={onScroll}
      scrollEventThrottle={SCROLL_EVENT_INTERVAL}
      style={styles.scroller}
    >
      <View
        ref={content}
        testID="chip-scroller-row"
        // A view of its own, so there is something to measure a chip against.
        collapsable={false}
        onFocus={onFocus}
        style={[
          styles.row,
          { gap: theme.spacing.sm, paddingHorizontal: inset },
        ]}
      >
        {children}
      </View>
    </ScrollView>
  );
}

/** One scroll event a frame is as often as the offset is read. */
const SCROLL_EVENT_INTERVAL = 16;

const styles = StyleSheet.create({
  scroller: {
    marginVertical: -FOCUS_RING_OUTSET,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: FOCUS_RING_OUTSET,
  },
});
