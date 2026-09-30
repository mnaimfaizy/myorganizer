import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the software keyboard is currently up.
 *
 * iOS listens for the `Will` events and Android for the `Did` ones, which is
 * the platform difference rather than a preference: iOS publishes the
 * animation ahead of it, so reacting on `Will` moves with the keyboard instead
 * of after it, while Android does not emit the `Will` pair at all and a
 * listener on it never fires.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hidden = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return visible;
}
