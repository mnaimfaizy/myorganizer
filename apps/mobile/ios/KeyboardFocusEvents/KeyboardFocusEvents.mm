#import "KeyboardFocusEvents.h"

#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// Full Keyboard Access moves UIKit's focus onto a control (`KeyboardFocusShim`
// in AppDelegate.swift lets it), but the control was never told. React Native
// 0.87's `RCTViewComponentView` sends `onFocus` and `onBlur` only from
// `didUpdateFocusInContext:`, and compiles that method only for tvOS, so on
// iOS a `Pressable` heard neither and the app's own focus ring never drew
// (#1021).
//
// This adds the missing method. It is Objective-C++ and not part of the Swift
// shim because the events leave through the view's C++ event emitter.
//
// It is a runtime addition to a React Native class, not an extension point.
// Remove it when React Native sends these events on iOS itself. If an upgrade
// gives the class the method, adding one is refused: a debug build stops at
// launch saying so, and a release build carries on with React Native's own.

@interface RCTViewComponentView (KeyboardFocusEvents)
@end

@implementation RCTViewComponentView (KeyboardFocusEvents)

// Whether focus on `focused` is focus on this view. It is when the two are the
// same view, and when `focused` is the switch this view exists to show: React
// Native's switch is a view holding a `UISwitch`, and it is the `UISwitch`
// that Full Keyboard Access stops on, so the app's `Switch` heard nothing and
// drew no ring (#1017). Only a switch: a text input holds a UIKit control the
// same way and reports its focus itself.
- (BOOL)keyboardFocusEvents_holds:(UIView *)focused
{
  if (focused == nil) {
    return NO;
  }
  return focused == self || (focused == self.contentView && [focused isKindOfClass:[UISwitch class]]);
}

- (void)keyboardFocusEvents_emitFocus
{
  if (_eventEmitter) {
    _eventEmitter->onFocus();
  }
}

- (void)keyboardFocusEvents_emitBlur
{
  if (_eventEmitter) {
    _eventEmitter->onBlur();
  }
}

@end

@implementation KeyboardFocusEvents

+ (void)install
{
  Class viewClass = [RCTViewComponentView class];
  SEL selector = @selector(didUpdateFocusInContext:withAnimationCoordinator:);
  Method inherited = class_getInstanceMethod(viewClass, selector);
  if (inherited == NULL) {
    NSAssert(NO, @"KeyboardFocusEvents: UIView.didUpdateFocusInContext is gone; "
                 @"the focus ring will not draw on iOS (#1021)");
    return;
  }

  typedef void (*DidUpdateFocus)(id, SEL, UIFocusUpdateContext *, UIFocusAnimationCoordinator *);
  DidUpdateFocus inheritedDidUpdateFocus = (DidUpdateFocus)method_getImplementation(inherited);

  // UIKit calls this on every view above the one losing focus and the one
  // gaining it, so the view asks whether it holds either before saying
  // anything.
  IMP didUpdateFocus = imp_implementationWithBlock(
      ^(RCTViewComponentView *view, UIFocusUpdateContext *context, UIFocusAnimationCoordinator *coordinator) {
        inheritedDidUpdateFocus(view, selector, context, coordinator);
        BOOL held = [view keyboardFocusEvents_holds:context.previouslyFocusedView];
        BOOL holds = [view keyboardFocusEvents_holds:context.nextFocusedView];
        if (holds && !held) {
          [view keyboardFocusEvents_emitFocus];
        } else if (held && !holds) {
          [view keyboardFocusEvents_emitBlur];
        }
      });

  // False means React Native now defines the method itself, and adding one
  // would have been ignored.
  BOOL added = class_addMethod(viewClass, selector, didUpdateFocus, method_getTypeEncoding(inherited));
  NSAssert(added, @"KeyboardFocusEvents: RCTViewComponentView defines "
                  @"didUpdateFocusInContext itself; remove this addition (#1021)");
}

@end
