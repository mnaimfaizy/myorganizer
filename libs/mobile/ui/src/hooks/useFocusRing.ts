import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlurEvent, FocusEvent, ViewStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { useInFrontFocusLayer } from './focusLayer';
import {
  focusTargetOf,
  noteBlur,
  noteFocus,
  type FocusTarget,
} from './focusReturn';

/** Where the ring sits: around the control, or inside a full-bleed one. */
export type FocusRingPlacement = 'outside' | 'inset';

/** The P3 focus indicator: 2 pt of the `focus` role. */
const RING_WIDTH = 2;

/** The gap between the control and the ring, outside placement only. */
const RING_GAP = 2;

/**
 * How far past its control an outside ring reaches. A scroller holding ringed
 * controls needs at least this much room around them (see `ChipScroller`).
 */
export const FOCUS_RING_OUTSET = RING_WIDTH + RING_GAP;

/** An inset ring sits flush inside the edge rather than past it. */
const OFFSET = {
  outside: RING_GAP,
  inset: -RING_WIDTH,
} as const satisfies Record<FocusRingPlacement, number>;

/**
 * Whether a focus or blur event came up from a control inside this one.
 *
 * Both events bubble, and `Pressable` hands its handlers every one that
 * reaches it. A row holding a checkbox therefore heard the checkbox take
 * focus and drew a second ring around itself (#1047). The event is this
 * control's own only when the view it came from is the view handling it. A
 * handler called without an event has nothing to compare and is the
 * control's own.
 */
function fromInside(event: FocusEvent | BlurEvent | undefined): boolean {
  return event != null && event.target !== event.currentTarget;
}

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
 * rendered controls rather than at this hook. It has been seen drawing on an
 * Android emulator driven by hardware key events, not on a physical device.
 * It does not draw on iOS, where React Native sends these two events only on
 * tvOS (#1021).
 *
 * The ring is drawn only in the layer in front. A control behind an open
 * sheet can hold its window's focus without ever being sent a blur (see
 * `focusLayer.ts`), and a ring there says focus is somewhere it is not.
 * `focused` stays what the control was told, so the ring returns with the
 * sheet's dismissal if the control still has focus.
 *
 * A control with a ringed control inside it — a task row and its checkbox —
 * is sent that control's focus and blur as well, because both events bubble.
 * The ring and the view noted below follow only the control's own.
 *
 * A control that hands `onFocus` its event also names the view focus can be
 * returned to once a screen it opened leaves (see `focusReturn.ts`). A text
 * input draws its ring without this hook, so it is never that view: it takes
 * focus in touch mode too, and returning focus to one would raise the
 * keyboard on a touch user.
 */
export function useFocusRing(placement: FocusRingPlacement = 'outside'): {
  focused: boolean;
  onFocus: (event?: FocusEvent) => void;
  onBlur: (event?: BlurEvent) => void;
  ringStyle: ViewStyle | null;
} {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const view = useRef<FocusTarget | null>(null);
  const onFocus = useCallback((event?: FocusEvent) => {
    if (fromInside(event)) return;
    setFocused(true);
    view.current = focusTargetOf(event?.currentTarget);
    if (view.current !== null) noteFocus(view);
  }, []);
  const onBlur = useCallback((event?: BlurEvent) => {
    if (fromInside(event)) return;
    setFocused(false);
    noteBlur(view);
  }, []);
  // A control removed while focused may never be sent its blur.
  useEffect(
    () => () => {
      noteBlur(view);
      view.current = null;
    },
    [],
  );
  const inFront = useInFrontFocusLayer();

  const ringStyle = useMemo<ViewStyle | null>(
    () =>
      focused && inFront
        ? {
            outlineWidth: RING_WIDTH,
            outlineStyle: 'solid',
            outlineColor: theme.colors.focus,
            outlineOffset: OFFSET[placement],
          }
        : null,
    [focused, inFront, placement, theme.colors.focus],
  );

  return { focused, onFocus, onBlur, ringStyle };
}
