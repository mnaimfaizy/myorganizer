#import <React/RCTBridgeModule.h>

// Bridges the Swift `RNSensitiveClipboard` class (see RNSensitiveClipboard.swift)
// to the React Native module registry. `RCT_EXTERN_MODULE` needs no import of
// the Swift class itself — the bridge resolves it at runtime by the name this
// macro registers, which must match the Swift class's `@objc(RNSensitiveClipboard)`
// annotation exactly.
@interface RCT_EXTERN_MODULE(RNSensitiveClipboard, NSObject)

RCT_EXTERN_METHOD(copy:(NSString *)value
                  sensitive:(BOOL)sensitive
                  expiresInSeconds:(nonnull NSNumber *)expiresInSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearIfOwned:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
