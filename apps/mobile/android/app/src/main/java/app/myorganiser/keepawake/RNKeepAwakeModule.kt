package app.myorganiser.keepawake

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Keeps the screen on while a Grocery List is open on a trip — the "Keep
 * screen awake on a trip" Device Setting (#908).
 *
 * `FLAG_KEEP_SCREEN_ON` on the current activity's window, set and cleared on
 * the UI thread. It needs no permission and lapses by itself when the window
 * goes away. The JavaScript side counts its callers, so this module only
 * sees the transitions between "someone wants it on" and "nobody does".
 */
class RNKeepAwakeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RNKeepAwake"

  @ReactMethod
  fun activate() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  @ReactMethod
  fun deactivate() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}
