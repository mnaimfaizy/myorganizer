import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/** Names the view in a test and in a device's view dump. */
export const FOCUS_LANDING_TEST_ID = 'focus-landing';

/**
 * The view Android gives keyboard focus to when it has to pick one itself
 * (#1042). Mounted once, first in the app's root, ahead of every screen.
 *
 * Outside touch mode Android does not leave a window without a focused view.
 * When the view holding focus is removed — or blurred, which is what
 * submitting a text input does — the window focuses the first focusable view
 * it holds, in mount order. That was whichever control happened to be first:
 * "Log out" for the whole of an unlock, then the header's Lock action, so
 * Enter to unlock followed by Enter locked the Vault again; the first tab-bar
 * item under a pushed screen, where Enter left the tab. `blur()` cannot undo
 * it, because clearing focus is the same pick made again.
 *
 * So the first focusable view is this one, which does nothing. It has no
 * press handler, so Enter on it is ignored; it draws nothing, so no ring
 * appears until the User presses Tab; and it sits at the window's top-left
 * corner, so that Tab goes to the first control of the screen.
 *
 * What it costs: it is a stop like any other, so a full Tab cycle passes
 * through it once and shows nothing there, and the first Tab after a touch
 * can land on it. Nothing in React Native keeps a view focusable and out of
 * the Tab order.
 *
 * Touch never reaches it: Android focuses nothing in touch mode, and it takes
 * no pointer events. A screen reader does not stop on it either — keyboard
 * focus and accessibility focus are separate, and it is marked unimportant to
 * the second.
 *
 * A sheet is a `Modal`, a window of its own with its own first focusable
 * view, and is not covered by this one. Nor is iOS, which is given nothing:
 * the behaviour is Android's, and no control there is told it has focus
 * (#1021).
 */
export function FocusLanding(): React.JSX.Element | null {
  if (Platform.OS !== 'android') return null;

  return (
    <View
      testID={FOCUS_LANDING_TEST_ID}
      focusable
      // React Native drops a view with no content from the native tree.
      collapsable={false}
      // Not `accessible={false}` as well: on Android that prop and
      // `focusable` set the same native flag, and whichever is applied last
      // wins. With it, this view mounted unfocusable.
      importantForAccessibility="no"
      pointerEvents="none"
      style={styles.landing}
    />
  );
}

const styles = StyleSheet.create({
  // Out of the layout, so nothing moves for it. One point rather than none:
  // Android will not focus a view with no size.
  landing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
  },
});
