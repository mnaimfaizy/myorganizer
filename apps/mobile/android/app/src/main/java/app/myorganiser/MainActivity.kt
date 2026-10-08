package app.myorganiser

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.uimanager.util.ReactFindViewUtil

/**
 * The `nativeID` of the view JavaScript mounts first in the app's root to hold keyboard focus when
 * no control does. `FocusLanding.tsx` holds the same string.
 */
private const val FOCUS_LANDING_NATIVE_ID = "focus-landing"

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Mobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Watches for a text input giving focus up to nothing, and hands the focus to the landing view.
   *
   * In touch mode Android does not replace a focus that is cleared, so a text input blurred by a
   * tap on a button, or removed with its screen, leaves the window with no focused view. The input
   * method is told about a new editor only when a view gains focus, so it goes on serving the one
   * that is gone: it takes the next hardware Tab for itself, raises the soft keyboard, and the key
   * never reaches the window (#1051). A view that is no editor gaining focus is what ends that
   * session, and Tab then moves from it.
   *
   * Outside touch mode Android has already focused the landing view by the time this is told, and
   * the new focus is not null.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val decor = window.decorView
    decor.viewTreeObserver.addOnGlobalFocusChangeListener { oldFocus, newFocus ->
      if (newFocus == null && oldFocus?.onCheckIsTextEditor() == true) {
        // Posted: JavaScript moving focus from one text input to another may blur the first before
        // it focuses the second, and that must not pass through here and restart the keyboard.
        decor.post(::focusLanding)
      }
    }
  }

  private fun focusLanding() {
    val decor = window.decorView
    if (decor.findFocus() != null) return
    val landing = ReactFindViewUtil.findView(decor, FOCUS_LANDING_NATIVE_ID) ?: return
    // A view takes focus in touch mode only if it says it can, and React Native has no prop for it.
    landing.isFocusableInTouchMode = true
    landing.requestFocus()
  }
}
