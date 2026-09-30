import Foundation
import React

/// The app's version and build as the bundle declares them
/// (`CFBundleShortVersionString`, `CFBundleVersion` — the project's
/// MARKETING_VERSION and CURRENT_PROJECT_VERSION), for Account's About row.
/// React Native exposes neither, and a copy in JavaScript would drift from
/// the one the App Store sees.
@objc(RNAppInfo)
class RNAppInfo: NSObject {

  @objc
  func constantsToExport() -> [AnyHashable: Any]! {
    let info = Bundle.main.infoDictionary ?? [:]
    return [
      "version": info["CFBundleShortVersionString"] as? String ?? "",
      "build": info["CFBundleVersion"] as? String ?? "",
    ]
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
