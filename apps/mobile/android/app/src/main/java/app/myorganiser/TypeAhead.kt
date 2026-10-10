package app.myorganiser

import android.os.SystemClock
import android.view.KeyEvent
import android.view.View

/** How long a key no view took is kept for a text input that has yet to take focus. */
private const val HELD_FOR_MS = 500L

/** The most keys kept at once: more than anyone types in [HELD_FOR_MS], and a bound anyway. */
private const val MOST_HELD = 64

/**
 * Keeps what is typed on a hardware keyboard between a press that opens a text input and that
 * input taking focus, and types it into the input once it has.
 *
 * JavaScript opens a field: the press goes to it, it renders the input, and the input is mounted
 * and focused some tens of milliseconds later. Until then no editor has focus, and a key that
 * writes text is taken by no view and dropped: the start of a Task's title typed straight after
 * "Add a task" (#1070), or of an amount on a grocery trip (#1053).
 *
 * Only keys no view handled are kept, so a key that did something is never typed as well, and
 * only for [HELD_FOR_MS]: a key pressed at a screen with no field is not waiting for the next
 * field opened.
 *
 * The keys are typed a turn of the main thread after the input takes focus, not as it does. The
 * window reports the new focus before the input has run its own focus handling, and an input
 * that selects its text on focus would then select what was just typed for the next key to
 * replace. Keys that arrive during that turn are kept behind the ones already held, so nothing
 * is typed out of order.
 *
 * A React Native `Modal` is a window of its own, and its keys do not come through the activity.
 */
class TypeAhead {

  private val held = ArrayDeque<KeyEvent>()
  private var owed = false

  /** Keeps [event] behind the keys already owed to an input. True when it was kept. */
  fun queueBehindOwed(event: KeyEvent): Boolean {
    if (!owed || !writesText(event)) return false
    held.addLast(event)
    return true
  }

  /** Keeps [event], a key no view handled, if it is one that writes text. */
  fun hold(event: KeyEvent) {
    dropStale()
    if (!writesText(event)) return
    if (held.size == MOST_HELD) held.removeFirst()
    held.addLast(event)
  }

  /** Types the keys still held into [input], which has just taken focus. */
  fun deliverTo(input: View) {
    dropStale()
    if (held.isEmpty() || owed) return
    owed = true
    input.post {
      owed = false
      val keys = held.toList()
      held.clear()
      if (input.isFocused) keys.forEach(input::dispatchKeyEvent)
    }
  }

  private fun dropStale() {
    if (owed) return
    val oldest = SystemClock.uptimeMillis() - HELD_FOR_MS
    while (held.isNotEmpty() && held.first().eventTime < oldest) held.removeFirst()
  }

  /**
   * A press that puts a character in a field, or Backspace following one held. Not a chord
   * (Ctrl+C), and not Enter or Tab, which act on a view instead of writing to it.
   */
  private fun writesText(event: KeyEvent): Boolean {
    if (event.action != KeyEvent.ACTION_DOWN) return false
    if (event.isCtrlPressed || event.isAltPressed || event.isMetaPressed) return false
    if (event.keyCode == KeyEvent.KEYCODE_DEL) return held.isNotEmpty()
    val char = event.unicodeChar
    return char != 0 && !Character.isISOControl(char)
  }
}
