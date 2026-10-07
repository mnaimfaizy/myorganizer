import { Platform, type ViewProps } from 'react-native';

/**
 * The props that make a view one accessibility element without making it a
 * keyboard stop: something a screen reader reads as a whole — the brand mark,
 * a read-only row — that does nothing when activated.
 *
 * **Only for a view that carries its own `accessibilityLabel` and holds no
 * text a screen reader could land on separately.** Everything else keeps
 * plain `accessible`. Without `accessible` nothing folds a view's children
 * into it on Android, and TalkBack (15, API 35) was observed to do this:
 *
 * - a container with no label, relying on its children's text (a notice, a
 *   field's error line): two stops — one saying only its role, "Alert", then
 *   the text on its own with no role;
 * - a plain `View` with a label and `Text` children (a read-only fact row,
 *   "Status, Active"): three stops — the row, then "Status", then "Active".
 *
 * It read as one stop, label and role together, only where the view had a
 * label and nothing of that kind inside: the mark-only `BrandMark`, whose
 * children are drawn, and a `ListRow` that does nothing, which is a
 * `Pressable`. So the notice, the error lines, the labelled meter and the
 * fact rows are still keyboard stops on Android; taking them out of the Tab
 * order needs a different answer than this one.
 *
 * `accessible` alone is that on iOS. On Android it is also what puts the view
 * in the Tab order: React Native's `ReactViewManager.setAccessible` is
 * `view.isFocusable = accessible`, and Android has one focusable flag for the
 * keyboard and the screen reader alike. `focusable={false}` does not take it
 * back — `setFocusable(false)` only removes the click listener, and says so:
 * "we might still want it to be focusable for accessibility reasons". So a
 * hardware keyboard stopped on every such view, where Android drew its own
 * grey highlight because nothing there draws a ring (#1014).
 *
 * `screenReaderFocusable` is Android's flag for the screen reader only (API
 * 28): TalkBack still lands on the view and reads it as one element, and Tab
 * passes it by. Below API 28 React Native ignores the prop and TalkBack falls
 * back to its own rule, which focuses a view carrying a label or text.
 *
 * Called at render rather than held as a constant, so a spec can render either
 * platform's answer.
 */
export function staticElement(): Pick<
  ViewProps,
  'accessible' | 'screenReaderFocusable'
> {
  return Platform.OS === 'android'
    ? { accessible: false, screenReaderFocusable: true }
    : { accessible: true };
}
