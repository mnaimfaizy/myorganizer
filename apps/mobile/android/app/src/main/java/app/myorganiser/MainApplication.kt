package app.myorganiser

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults
import app.myorganiser.appinfo.RNAppInfoPackage
import app.myorganiser.biometrickeystore.RNBiometricKeystorePackage
import app.myorganiser.keepawake.RNKeepAwakePackage
import app.myorganiser.sensitiveclipboard.RNSensitiveClipboardPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(RNSensitiveClipboardPackage())
          add(RNBiometricKeystorePackage())
          add(RNKeepAwakePackage())
          add(RNAppInfoPackage())
        },
      // The entry file of this Nx app is src/main.tsx, not index.js.
      jsMainModulePath = "src/main",
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ReactNativeFeatureFlags.dangerouslyForceOverride(KeyboardFocusFeatureFlags())
  }
}

/**
 * React Native's stable feature flags with two changed for a hardware keyboard: its custom focus
 * search turned off, and focus requests from JavaScript turned on.
 *
 * With `enableCustomFocusSearchOnClippedElementsAndroid` on, a scroll view second-guesses Android
 * whenever Tab or Shift+Tab would move focus out of it: it searches its own content again and, if
 * anything in there counts as "forward", sends focus to that instead. Its test for "forward" also
 * accepts a control that merely sits further right, however far above. So Tab from the last control
 * in a scroll view jumped back up to an earlier one whenever something above it reached further
 * right, and never got to what follows the scroll view: on Tasks it cycled between "Work" and
 * "Show done" and never reached the composer or the tab bar (#1015).
 *
 * The search exists to reach views `removeClippedSubviews` has detached, which nothing in this app
 * sets. Android's own focus order is the right one here, so the flag is off. `loadReactNative`
 * has already installed the stable flags and they can be set only once, hence the forced override.
 *
 * With `enableImperativeFocus` off, `focus()` and `blur()` on anything but a text input do nothing:
 * JavaScript sends no command, and `ReactViewManager` ignores one. The app needs `focus()` once, to
 * put focus back on the control that opened a pushed screen when that screen is popped; Android
 * gives it to the first tab-bar item instead (#1034, `focusReturn.ts`). The flag is experimental
 * and switches on nothing else on Android. A text input is focused through its own path either way.
 */
private class KeyboardFocusFeatureFlags : ReactNativeNewArchitectureFeatureFlagsDefaults() {
  override fun enableCustomFocusSearchOnClippedElementsAndroid(): Boolean = false

  override fun enableImperativeFocus(): Boolean = true
}
