import Foundation
import UIKit

/// The iOS half of the Details slice's Sensitive Clipboard.
///
/// No maintained React Native clipboard library exposes `UIPasteboard`'s
/// local-only, expiring item options as of this slice, so this app carries a
/// few dozen lines of platform code instead of a dependency that would only
/// do half the job — see `nativeSensitiveClipboard.ts` for the Android half
/// and why neither is a bare `setString`.
///
/// `localOnly` keeps a copy off Universal Clipboard, so it never reaches
/// another signed-in Apple device; `expirationDate` is what makes the system
/// itself drop the item after the interval the caller asks for, rather than
/// this module having to remember to.
@objc(RNSensitiveClipboard)
class RNSensitiveClipboard: NSObject {

  /// The UTI this module writes and reads plain text under. Matching the one
  /// `UIPasteboard.string` itself reads is what makes `clearIfOwned`'s
  /// equality check see the same value this module wrote.
  private static let plainTextType = "public.utf8-plain-text"

  @objc(copy:sensitive:expiresInSeconds:resolver:rejecter:)
  func copy(
    _ value: String,
    sensitive: Bool,
    expiresInSeconds: NSNumber,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    // `sensitive` is Android-only (the `EXTRA_IS_SENSITIVE` flag Android 13+
    // reads); iOS has no per-item "hide the preview" primitive; its privacy
    // answer is `localOnly` below, applied unconditionally.
    var options: [UIPasteboard.OptionsKey: Any] = [.localOnly: true]
    let seconds = expiresInSeconds.doubleValue
    if seconds > 0 {
      options[.expirationDate] = Date().addingTimeInterval(seconds)
    }
    DispatchQueue.main.async {
      UIPasteboard.general.setItems(
        [[RNSensitiveClipboard.plainTextType: value]],
        options: options
      )
      resolve(nil)
    }
  }

  @objc(clearIfOwned:resolver:rejecter:)
  func clearIfOwned(
    _ value: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      // Re-reads the live pasteboard rather than trusting the caller's own
      // memory of what it copied, so a value the User has since copied from
      // another app — or an item the system already expired — is left alone.
      if UIPasteboard.general.string == value {
        UIPasteboard.general.items = []
      }
      resolve(nil)
    }
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
