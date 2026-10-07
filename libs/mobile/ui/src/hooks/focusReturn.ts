import { useEffect, useState } from 'react';

/** A view that can be handed focus again. */
export interface FocusTarget {
  focus: () => void;
}

/**
 * One control's slot for the view its last focus event came from, owned by
 * its `useFocusRing`. The slot is what gets remembered, never the view: the
 * control empties it when it unmounts, so nothing here outlives a view.
 */
export interface FocusSlot {
  current: FocusTarget | null;
}

/**
 * The control holding focus now, as far as the rings were told.
 *
 * React Native has no "which view is focused" outside text inputs, so this is
 * kept from the same two events the ring is drawn from. It is the control a
 * hardware keyboard last moved to and has not left: touching the screen takes
 * the window into touch mode, which blurs it, so after a touch this is `null`.
 */
let focusedSlot: FocusSlot | null = null;

/**
 * The view an event names as the one it came from, if it can take focus. The
 * legacy renderer names a number instead, which cannot.
 */
export function focusTargetOf(target: unknown): FocusTarget | null {
  return typeof target === 'object' &&
    target !== null &&
    typeof (target as Partial<FocusTarget>).focus === 'function'
    ? (target as FocusTarget)
    : null;
}

/** Called by `useFocusRing` when its control takes focus. */
export function noteFocus(slot: FocusSlot): void {
  focusedSlot = slot;
}

/** Called by `useFocusRing` when its control loses focus, or unmounts. */
export function noteBlur(slot: FocusSlot): void {
  if (focusedSlot === slot) focusedSlot = null;
}

/**
 * Hands focus back to the control that opened a screen when that screen
 * leaves. Called once by the screen's layout.
 *
 * Android does not do this itself (#1034). When the focused view is removed
 * outside touch mode, the window gives focus to the first focusable view it
 * still holds, and while a pushed screen is being popped that is the first
 * item of the tab bar: the screen underneath is not back in the window yet.
 * So Back from a screen opened with Enter drew a ring on "Groceries" in every
 * tab, and the next Enter would have left the tab.
 *
 * The opener is read during the first render, before the new screen takes
 * focus from it. Nothing is noted after a touch, so a screen opened by touch
 * returns no focus; and Android refuses the request in touch mode, so a screen
 * opened by key and left by touch draws no ring either. An opener that has
 * unmounted since — its row was deleted on the screen it opened — has emptied
 * its slot, and focus is left where Android put it.
 *
 * `focus()` on a view does nothing unless React Native's
 * `enableImperativeFocus` flag is on, which `MainApplication.kt` does for
 * Android. On iOS it is off, and no control is ever noted there (#1021).
 */
export function useReturnFocusOnLeave(): void {
  const [opener] = useState(() => focusedSlot);
  useEffect(() => () => opener?.current?.focus(), [opener]);
}
