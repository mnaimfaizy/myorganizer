package app.myorganiser.sensitiveclipboard

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The Android half of the Details slice's Sensitive Clipboard.
 *
 * No maintained React Native clipboard library exposes Android 13's
 * per-copy `EXTRA_IS_SENSITIVE` flag as of this slice (it is still an open
 * feature request against `@react-native-clipboard/clipboard`), so this app
 * carries the few lines itself rather than a dependency that would only do
 * half the job — see `nativeSensitiveClipboard.ts` for the other half.
 *
 * `clearIfOwned` never trusts a value the caller merely remembers copying:
 * it re-reads the live clipboard and clears only when the text there still
 * matches, so a value the User has since copied from another app is left
 * alone.
 */
class RNSensitiveClipboardModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RNSensitiveClipboard"

  private val clipboardManager: ClipboardManager
    get() =
        reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE)
            as ClipboardManager

  @ReactMethod
  fun copy(value: String, sensitive: Boolean, expiresInSeconds: Double, promise: Promise) {
    // `expiresInSeconds` is iOS-only (`UIPasteboard`'s own expiry); Android has
    // no equivalent primitive, so a timed clear on this platform is only ever
    // the caller-driven `clearIfOwned`, same as the plain copy path.
    val clip = ClipData.newPlainText("", value)
    if (sensitive && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val extras = PersistableBundle()
      extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
      clip.description.extras = extras
    }
    clipboardManager.setPrimaryClip(clip)
    promise.resolve(null)
  }

  @ReactMethod
  fun clearIfOwned(value: String, promise: Promise) {
    val current = clipboardManager.primaryClip
    val currentText = current?.let {
      if (it.itemCount > 0) it.getItemAt(0).coerceToText(reactApplicationContext) else null
    }
    if (currentText?.toString() == value) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        clipboardManager.clearPrimaryClip()
      } else {
        clipboardManager.setPrimaryClip(ClipData.newPlainText("", ""))
      }
    }
    promise.resolve(null)
  }
}
