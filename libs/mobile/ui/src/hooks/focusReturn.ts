import { useCallback, useEffect, useState, type RefObject } from 'react';

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
 * Who takes a view's place once it has gone, as told by whoever knows the
 * order it was drawn in — a list, for its rows (`useFocusSuccession`). Keyed
 * by the view and held weakly, so an entry lasts as long as something still
 * remembers the view and no longer.
 */
const successors = new WeakMap<FocusTarget, () => FocusTarget | null>();

/**
 * Names who to ask where the focus `view` held belongs once the screen it
 * opened leaves (`useReturnFocusOnLeave`): `view` itself while it is still
 * mounted, and the view standing in its place after it has gone. Answered as
 * things stand when it is asked.
 */
export function nameSuccessor(
  view: FocusTarget,
  successor: () => FocusTarget | null,
): void {
  successors.set(view, successor);
}

/**
 * The view of the control holding keyboard focus now, or `null`: after a
 * touch, and while focus is in a text input, which notes nothing. iOS keeps
 * focus where Full Keyboard Access left it through a touch, so there a touch
 * does not make this `null`.
 */
export function keyboardFocusedView(): FocusTarget | null {
  return focusedSlot?.current ?? null;
}

/**
 * Whether a control holds keyboard focus now — the evidence that what the
 * User just did, they did with a hardware keyboard (#1068). A press by touch
 * finds it `false`: touching the screen blurs the control that had focus and
 * focuses none. So does Return in a text input, by either keyboard; a screen
 * that needs to tell those apart has to go by how the input was reached.
 */
export function keyboardHoldsFocus(): boolean {
  return keyboardFocusedView() !== null;
}

/**
 * Returns a function that asks for focus on `target` once the render the
 * request causes has been committed — for a control that is only mounted by
 * that render, as the collapsed Tasks composer is by the save that closes the
 * open one (#1068).
 *
 * A request whose target is not mounted after that render is dropped, not
 * kept for a later one: a focus that arrives late takes it from wherever the
 * User has moved since. Android refuses the request in touch mode, and iOS
 * sends none (see `useReturnFocusOnLeave`), so asking is only wrong when the
 * User did not act by keyboard — which the caller checks, with
 * `keyboardHoldsFocus`, before the action removes the evidence.
 */
export function useFocusAfterCommit(
  target: RefObject<FocusTarget | null>,
): () => void {
  const [request, setRequest] = useState(0);
  useEffect(() => {
    if (request > 0) target.current?.focus();
  }, [request, target]);
  return useCallback(() => setRequest((count) => count + 1), []);
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
 * opened by key and left by touch draws no ring either.
 *
 * An opener can have unmounted since — its row was deleted on the screen it
 * opened. Focus then goes to whoever was named to stand in its place
 * (`nameSuccessor`): on a list, the row that moved up into it (#1075). It is
 * asked as the screen leaves and not when the opener went, because the two
 * can be a long time apart and the list can change between them. An opener
 * nobody named a successor for has emptied its slot, or is about to, and
 * focus is left where Android put it.
 *
 * `focus()` on a view does nothing unless React Native's
 * `enableImperativeFocus` flag is on, which `MainApplication.kt` does for
 * Android. On iOS it is off: a control is noted there once Full Keyboard
 * Access has moved to it, and handing focus back to it does nothing.
 */
export function useReturnFocusOnLeave(): void {
  const [opener] = useState(() => ({
    slot: focusedSlot,
    // The slot is emptied with its control, so the view is kept beside it:
    // it is what a successor was named for.
    view: focusedSlot?.current ?? null,
  }));
  useEffect(
    () => () => {
      const { slot, view } = opener;
      // A named successor is asked first, whether or not the slot still holds
      // the view: the control's ref is detached in the commit that removes
      // it, and its slot only when that commit's effects are cleaned up,
      // which can be after this.
      const successor = view === null ? undefined : successors.get(view);
      const target = successor !== undefined ? successor() : slot?.current;
      target?.focus();
    },
    [opener],
  );
}
