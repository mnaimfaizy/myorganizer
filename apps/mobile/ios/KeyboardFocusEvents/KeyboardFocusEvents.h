#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Sends a React Native view the focus and blur events iOS never gives it.
///
/// See KeyboardFocusEvents.mm.
@interface KeyboardFocusEvents : NSObject

/// Call once at launch, before React Native starts.
+ (void)install;

@end

NS_ASSUME_NONNULL_END
