#import <React/RCTBridgeModule.h>

// Bridges the Swift `RNKeepAwake` class (see RNKeepAwake.swift) to the React
// Native module registry, by the name its `@objc(RNKeepAwake)` annotation
// registers.
@interface RCT_EXTERN_MODULE(RNKeepAwake, NSObject)

RCT_EXTERN_METHOD(activate)

RCT_EXTERN_METHOD(deactivate)

@end
