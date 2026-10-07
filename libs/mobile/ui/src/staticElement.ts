import { Platform, type ViewProps } from 'react-native';

/**
 * The props that make a view one accessibility element without making it a
 * keyboard stop: something a screen reader reads as a whole — the brand mark,
 * a notice, a field's error line, a read-only row — that does nothing when
 * activated.
 *
 * `accessible` alone is that on iOS. On Android it is also what puts the view
 * in the Tab order: React Native's `ReactViewManager.setAccessible` is
 * `view.isFocusable = accessible`, and Android has one focusable flag for the
 * keyboard and the screen reader alike. `focusable={false}` does not take it
 * back — `setFocusable(false)` only removes the click listener, and says so:
 * "we might still want it to be focusable for accessibility reasons". So a
 * hardware keyboard stopped on every such view, where Android drew its own
 * grey highlight because nothing there draws a ring (#1014, #1025).
 *
 * `screenReaderFocusable` is Android's flag for the screen reader only (API
 * 28): TalkBack still lands on the view, and Tab passes it by. Below API 28
 * React Native ignores the prop and TalkBack falls back to its own rule,
 * which focuses a view carrying a label or text.
 *
 * **On Android the view then needs two things `accessible` used to supply,
 * and a site that leaves either out is read in pieces.** Without `accessible`
 * nothing folds a view's children into it, and TalkBack (15, API 35) was
 * observed to land on the view and then on each `Text` inside it: a notice
 * became "Alert" and then its message; a labelled fact row became "Status,
 * Active", "Status", "Active".
 *
 * 1. **Its own label.** Pass the text the element is read as — `label` here,
 *    or an `accessibilityLabel` the view already carries on both platforms.
 *    `label` is set on Android only, so iOS goes on reading the children
 *    exactly as it did.
 * 2. **Nothing inside for a screen reader to land on.** Every `Text` in it
 *    takes `importantForAccessibility="no"`, and a wrapper holding several
 *    takes `"no-hide-descendants"`. The prop is Android's alone; iOS already
 *    hides the children of an `accessible` view.
 *
 * With both, TalkBack reads one stop with the label and the role together —
 * "Enter your passphrase. Alert" — which is what it read from the
 * `accessible` view. `staticElement.test.tsx` holds every site to the second
 * rule, because nothing else fails when a `Text` is added without it.
 *
 * A scroll view whose content is all static elements has nothing focusable
 * inside, so Android makes the scroll view itself the one keyboard stop there
 * (and draws its highlight over it): that is how the arrow keys scroll it.
 *
 * Called at render rather than held as a constant, so a spec can render either
 * platform's answer.
 */
export function staticElement(
  label?: string,
): Pick<
  ViewProps,
  'accessible' | 'screenReaderFocusable' | 'accessibilityLabel'
> {
  return Platform.OS === 'android'
    ? {
        accessible: false,
        screenReaderFocusable: true,
        ...(label != null && { accessibilityLabel: label }),
      }
    : { accessible: true };
}
