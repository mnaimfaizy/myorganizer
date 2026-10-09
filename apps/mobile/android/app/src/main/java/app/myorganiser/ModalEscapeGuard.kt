package app.myorganiser

import android.app.Dialog
import android.view.Window
import com.facebook.react.interfaces.ExtraWindowEventListener

/**
 * Leaves closing a React Native `Modal` to JavaScript when Escape is pressed.
 *
 * The Modal's host shows its content in a [Dialog] and asks JavaScript to close it
 * (`onRequestClose`) on the release of Back or Escape. A dialog is cancelable unless told
 * otherwise, though, and a cancelable one cancels itself on the press of Escape
 * (`Dialog.onKeyDown`) whenever no focused view takes the key first. Nothing tells the host: the
 * window went, `onRequestClose` never ran, and the screen behind stayed inert under a sheet it
 * still held open (#1095). A focused text input does take the key, which is why the first Escape
 * in a field behaved.
 *
 * A dialog that is neither cancelable nor closed by a touch outside leaves Escape alone, so its
 * release reaches the host as Back's does. Back never went through the dialog's own cancel: the
 * host answers it first.
 *
 * The host reports each dialog's window here once it is shown, and a dialog is its window's
 * callback, which is the only way from one to the other.
 */
object ModalEscapeGuard : ExtraWindowEventListener {

  override fun onExtraWindowCreate(window: Window) {
    val dialog = window.callback as? Dialog ?: return
    dialog.setCancelable(false)
    dialog.setCanceledOnTouchOutside(false)
  }

  override fun onExtraWindowDestroy(window: Window) = Unit
}
