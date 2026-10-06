import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    KeyboardFocusShim.install()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Mobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "src/main")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

/// Lets Full Keyboard Access reach the app's controls.
///
/// Full Keyboard Access moves through UIKit's focus system, which only stops
/// on a view whose `canBecomeFocused` is true. React Native 0.87's
/// `RCTViewComponentView` answers with a flag it only ever sets when built
/// for tvOS, so on iOS every React Native view refused focus and a keyboard
/// User could reach nothing but text fields (#1013).
///
/// This replaces that one answer at launch. A view takes focus when it is the
/// kind a `Pressable` renders: an enabled accessibility element that is not
/// plain text, a heading, or an image. `Text` and the native switch are other
/// classes and keep their own answer.
///
/// It also gives each such view a focus group of its own. Tab moves between
/// focus groups and the arrow keys move inside one; left alone, a whole
/// screen below its header was a single group, so Tab went from "Log out" to
/// the Passphrase field and back while "Unlock" and the link under it could
/// only be reached with the arrows.
///
/// It is a runtime override of a React Native method, not an extension point.
/// Remove it when React Native sets `focusable` on iOS itself, and check it
/// on every React Native upgrade: if the class or the method is renamed this
/// does nothing, silently, and #1013 comes back.
enum KeyboardFocusShim {
  private static let viewClassName = "RCTViewComponentView"

  /// Traits that mark an accessibility element as something to read, not
  /// something to operate.
  private static let passiveTraits: UIAccessibilityTraits = [
    .staticText, .header, .summaryElement, .updatesFrequently, .notEnabled,
  ]

  static func install() {
    guard
      let viewClass = NSClassFromString(viewClassName),
      let method = class_getInstanceMethod(
        viewClass, #selector(getter: UIView.canBecomeFocused))
    else {
      return
    }

    let canBecomeFocused: @convention(block) (UIView) -> Bool = { view in
      takesFocus(view, viewClass: viewClass)
    }
    method_setImplementation(method, imp_implementationWithBlock(canBecomeFocused))

    // `focusGroupIdentifier` is UIView's own method here, not React Native's,
    // so the override is added to the React Native class rather than set on
    // the method found: setting it would change every UIView in the process.
    let groupSelector = #selector(getter: UIView.focusGroupIdentifier)
    guard let inherited = class_getInstanceMethod(viewClass, groupSelector) else {
      return
    }
    typealias GroupGetter = @convention(c) (UIView, Selector) -> NSString?
    let inheritedGroup = unsafeBitCast(
      method_getImplementation(inherited), to: GroupGetter.self)
    let focusGroupIdentifier: @convention(block) (UIView) -> NSString? = { view in
      guard takesFocus(view, viewClass: viewClass) else {
        return inheritedGroup(view, groupSelector)
      }
      return "app.myorganiser.focus.\(ObjectIdentifier(view).hashValue)" as NSString
    }
    class_addMethod(
      viewClass, groupSelector,
      imp_implementationWithBlock(focusGroupIdentifier),
      method_getTypeEncoding(inherited))
  }

  private static func takesFocus(_ view: UIView, viewClass: AnyClass) -> Bool {
    guard type(of: view) == viewClass, view.isAccessibilityElement else {
      return false
    }
    let traits = view.accessibilityTraits
    if !traits.isDisjoint(with: passiveTraits) {
      return false
    }
    // An image is passive unless it is also a button.
    return !traits.contains(.image) || traits.contains(.button)
  }
}
