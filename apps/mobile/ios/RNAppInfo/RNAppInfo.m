#import <React/RCTBridgeModule.h>

// Bridges the Swift `RNAppInfo` class (see RNAppInfo.swift) to the React
// Native module registry. It has no methods — only the constants it exports.
@interface RCT_EXTERN_MODULE(RNAppInfo, NSObject)
@end
