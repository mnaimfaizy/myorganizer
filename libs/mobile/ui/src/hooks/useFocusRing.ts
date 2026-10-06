import { useCallback, useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';

/** Where the ring sits: around the control, or inside a full-bleed one. */
export type FocusRingPlacement = 'outside' | 'inset';

/** The P3 focus indicator: 2 pt of the `focus` role. */
const RING_WIDTH = 2;

/** The gap between the control and the ring, outside placement only. */
const RING_GAP = 2;

/** An inset ring sits flush inside the edge rather than past it. */
const OFFSET = {
  outside: RING_GAP,
  inset: -RING_WIDTH,
} as const satisfies Record<FocusRingPlacement, number>;

/**
 * The focus indicator every control in this library draws — P3 in the
 * approved design: 2 pt of the `focus` role with a 2 pt gap, because the
 * `ring` token falls below 3:1 against the surface in both modes.
 *
 * A full-bleed control — a list row, a section header, a tab — takes the ring
 * `inset`, since an outside ring would be clipped by the screen edge.
 *
 * Drawn with the `outline*` styles (React Native 0.77+), which follow the
 * control's own radius and take no layout space, so a focused control does
 * not shift its neighbours.
 *
 * React Native 0.79's `Pressable` never called the two handlers this
 * returns: it spread its own Pressability handlers after the caller's props,
 * and its Pressability config carried no `onFocus`/`onBlur`. React Native
 * 0.87's `Pressable` passes both into that config, so the ring is now
 * reachable, and `focusRing.test.tsx` holds it there by firing focus at
 * rendered controls rather than at this hook. It has not been seen on a
 * device with a keyboard attached; until it has, treat the ring as wired
 * rather than as verified.
 */
export function useFocusRing(placement: FocusRingPlacement = 'outside'): {
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  ringStyle: ViewStyle | null;
} {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  const ringStyle = useMemo<ViewStyle | null>(
    () =>
      focused
        ? {
            outlineWidth: RING_WIDTH,
            outlineStyle: 'solid',
            outlineColor: theme.colors.focus,
            outlineOffset: OFFSET[placement],
          }
        : null,
    [focused, placement, theme.colors.focus],
  );

  return { focused, onFocus, onBlur, ringStyle };
}
