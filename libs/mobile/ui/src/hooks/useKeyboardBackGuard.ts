import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How long after the soft keyboard has gone a close request is still read as
 * the press that hid it.
 */
export const KEYBOARD_BACK_GRACE_MS = 500;

/** What a sheet knows of the soft keyboard when it is asked to close. */
export interface SoftKeyboardState {
  visible: boolean;
  /**
   * When it was last hidden by something other than this guard, on
   * `Date.now()`'s clock; `null` once a press has been spent on it.
   */
  hiddenAt: number | null;
}

/**
 * Whether a close request is spent on the soft keyboard and leaves the sheet
 * up: the keyboard is showing, or went so recently that the press that hid it
 * is the one now asking.
 */
export function closeRequestHidesKeyboardOnly(
  keyboard: SoftKeyboardState,
  now: number,
): boolean {
  if (keyboard.visible) return true;
  return (
    keyboard.hiddenAt !== null &&
    now - keyboard.hiddenAt <= KEYBOARD_BACK_GRACE_MS
  );
}

/**
 * The `onRequestClose` of a sheet on Android: Back or Escape with the soft
 * keyboard up hides the keyboard and keeps the sheet and what was typed in
 * it; the next one closes the sheet (#949).
 *
 * React Native's Modal asks to close on the key's release, for Back and for
 * Escape alike, and does not look at the keyboard:
 *
 * - Escape is not the keyboard's key, so with a hardware keyboard and the
 *   soft one showing, one Escape closed the sheet over a filled-in form.
 * - Back is the keyboard's key first. Where the keyboard takes the whole
 *   press the Modal is never asked and this guard has nothing to do. Where it
 *   takes only the press's first half, the release still reaches the Modal
 *   after the keyboard has gone — which is what the grace period is for.
 *
 * iOS has no such request, and a sheet there is unchanged.
 */
export function useKeyboardBackGuard(onDismiss: () => void): () => void {
  const keyboard = useRef<SoftKeyboardState>({
    visible: false,
    hiddenAt: null,
  });
  // The keyboard is on its way down because this guard sent it; the next
  // close request is a press of its own and closes the sheet.
  const dismissing = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    // A sheet can be mounted over a keyboard that is already up.
    keyboard.current = { visible: Keyboard.isVisible(), hiddenAt: null };
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      dismissing.current = false;
      keyboard.current = { visible: true, hiddenAt: null };
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboard.current = {
        visible: false,
        hiddenAt: dismissing.current ? null : Date.now(),
      };
      dismissing.current = false;
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return useCallback(() => {
    if (
      Platform.OS !== 'android' ||
      !closeRequestHidesKeyboardOnly(keyboard.current, Date.now())
    ) {
      onDismiss();
      return;
    }
    if (keyboard.current.visible) {
      dismissing.current = true;
      Keyboard.dismiss();
    }
    // One press, one thing: the next request closes the sheet.
    keyboard.current = { visible: false, hiddenAt: null };
  }, [onDismiss]);
}
