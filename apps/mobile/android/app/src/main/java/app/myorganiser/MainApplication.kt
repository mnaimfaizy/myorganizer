package app.myorganiser

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
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
  }
}
