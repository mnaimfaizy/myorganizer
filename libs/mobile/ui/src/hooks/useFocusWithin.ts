import { useCallback, useEffect, useRef } from 'react';

/**
 * Tells a group of controls when keyboard focus has left all of them
 * (#1046). Returns the two handlers for the view that contains the group.
 *
 * A group that closes when focus leaves it cannot hang that on one member's
 * blur. The Tasks composer collapsed on its title field's blur, so a hardware
 * keyboard's Tab from the title to the chip beside it closed the composer the
 * chip was in.
 *
 * Focus and blur bubble, so the containing view hears both from every
 * control inside it, text inputs included. A member loses focus before the
 * next one is told it has it, so the blur alone does not say whether focus
 * left: the check waits until the events behind the blur have all been
 * handled, and a focus arriving inside the group in that time calls it off.
 *
 * Touch reads the same way. A tap on a button leaves focus in the text input
 * it was in, so no blur arrives and the group stays; a tap that dismisses the
 * keyboard blurs the input with nothing focused after it, and the group is
 * told focus left.
 *
 * On iOS a control other than a text input sends these two events only when
 * Full Keyboard Access moves focus to or from it (#1021); a touch there moves
 * focus between text inputs and nothing else.
 */
export function useFocusWithin(onLeave: () => void): {
  onFocus: () => void;
  onBlur: () => void;
} {
  const leave = useRef(onLeave);
  useEffect(() => {
    leave.current = onLeave;
  }, [onLeave]);

  // The check a blur left owing, until it runs or a focus calls it off.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onBlur = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      leave.current();
    }, 0);
  }, [cancel]);

  return { onFocus: cancel, onBlur };
}
