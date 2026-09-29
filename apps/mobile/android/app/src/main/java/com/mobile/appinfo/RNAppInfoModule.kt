package com.mobile.appinfo

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

/**
 * The app's version and build as the package declares them (`versionName`,
 * `versionCode` in app/build.gradle), for Account's About row. React Native
 * exposes neither, and a copy in JavaScript would drift from the one the
 * store sees.
 */
class RNAppInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RNAppInfo"

  override fun getConstants(): Map<String, Any> {
    val context = reactApplicationContext
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    val build =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
        else @Suppress("DEPRECATION") info.versionCode.toLong()
    return mapOf("version" to (info.versionName ?: ""), "build" to build.toString())
  }
}
