package com.mobile.sensitiveclipboard

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Registers `RNSensitiveClipboardModule` with the React Native bridge. */
class RNSensitiveClipboardPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(RNSensitiveClipboardModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
