package app.myorganiser

import android.graphics.drawable.Drawable
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import android.view.Window
import androidx.appcompat.widget.SwitchCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.interfaces.ExtraWindowEventListener
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import java.util.WeakHashMap

/**
 * Tells JavaScript when a switch takes or gives up focus, which React Native does not.
 *
 * Every other view's `onFocus` and `onBlur` come from a focus listener `BaseViewManager` attaches
 * in `addEventEmitters`. React Native 0.87's `ReactSwitchManager` overrides that method to attach
 * its checked-change listener and does not call the base, so the switch is the one view that never
 * reports its focus, and the app's `Switch` could not draw its focus ring for a hardware keyboard
 * (#1017). The manager is internal to a prebuilt library, so the listener cannot be added there.
 *
 * A window's focus changes are reported for the whole tree, switches included, so the events are
 * sent from here instead: the ones `BaseViewManager` would have sent, under the same names.
 *
 * A focused switch also loses the platform's own mark for as long as it holds focus: the grey halo
 * round its thumb, which is the focused state of the ripple the switch has for a background. The
 * app draws one focus indicator, the ring, and keeps the platform's fill off every other focused
 * control the same way (#1018). A switch takes focus only from a keyboard, never from a touch, so
 * a touch still gets its ripple; a press by key draws none, as on those controls.
 *
 * Registered on the activity's window (`MainActivity`) and on each window a React Native `Modal`
 * opens, which has a focus of its own and is reported here by the host once it is shown.
 *
 * Remove it when React Native's switch reports its own focus. Until someone does, that switch
 * carries a focus listener and this stays quiet for it, so no event is sent twice.
 */
object SwitchFocusEvents : ViewTreeObserver.OnGlobalFocusChangeListener, ExtraWindowEventListener {

  fun watch(window: Window) {
    window.decorView.viewTreeObserver.addOnGlobalFocusChangeListener(this)
  }

  override fun onGlobalFocusChanged(oldFocus: View?, newFocus: View?) {
    send(oldFocus, BLUR)
    send(newFocus, FOCUS)
  }

  override fun onExtraWindowCreate(window: Window) = watch(window)

  override fun onExtraWindowDestroy(window: Window) = Unit

  private fun send(view: View?, eventName: String) {
    // React Native's switch class is internal; the platform switch it extends is not, and nothing
    // else in a React Native tree is one.
    if (view !is SwitchCompat || view.onFocusChangeListener != null) return
    val context = view.context as? ReactContext ?: return
    val surfaceId = UIManagerHelper.getSurfaceId(context)
    if (surfaceId == View.NO_ID) return
    if (eventName == FOCUS) hideHalo(view) else restoreHalo(view)
    UIManagerHelper.getEventDispatcher(context)
        ?.dispatchEvent(SwitchFocusEvent(surfaceId, view.id, eventName))
  }

  private fun hideHalo(view: View) {
    val halo = view.background ?: return
    halos[view] = halo
    // A focused view with no background is given the platform's default highlight instead, from
    // the release that introduced one.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) view.defaultFocusHighlightEnabled = false
    view.background = null
  }

  private fun restoreHalo(view: View) {
    val halo = halos.remove(view) ?: return
    // A background set while the switch held focus is newer than the one put aside.
    if (view.background == null) view.background = halo
  }

  /** The background of each switch holding focus, put aside until it gives the focus up. */
  private val halos = WeakHashMap<View, Drawable>()

  private const val FOCUS = "topFocus"
  private const val BLUR = "topBlur"
}

/** React Native's own `FocusEvent` and `BlurEvent`, which are internal to it, as one class. */
private class SwitchFocusEvent(surfaceId: Int, viewTag: Int, private val name: String) :
    Event<SwitchFocusEvent>(surfaceId, viewTag) {

  override fun getEventName(): String = name

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap =
      Arguments.createMap().apply { putInt("target", viewTag) }
}
