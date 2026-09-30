package com.mobile.biometrickeystore

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Registers `RNBiometricKeystoreModule` with the React Native bridge. */
class RNBiometricKeystorePackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(RNBiometricKeystoreModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
