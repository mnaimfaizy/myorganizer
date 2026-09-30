import Foundation
import React
import UIKit

/// Keeps the screen on while a Grocery List is open on a trip — the "Keep
/// screen awake on a trip" Device Setting (#908).
///
/// A few lines of platform code rather than a dependency: all it does is
/// hold `UIApplication.isIdleTimerDisabled`, which must be set on the main
/// thread. The JavaScript side counts its callers, so this module only ever
/// sees the transitions between "someone wants it on" and "nobody does".
@objc(RNKeepAwake)
class RNKeepAwake: NSObject {

  @objc
  func activate() {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = true
    }
  }

  @objc
  func deactivate() {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = false
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
