// The native keep-screen-on switch: `RNKeepAwake`, a local module in
// apps/mobile (ios/RNKeepAwake, android … /keepawake). Split from
// ./keepAwakeCounter.ts so the counting is tested without a native module.
import { NativeModules } from 'react-native';
import { createKeepAwakeCounter, type ScreenWake } from './keepAwakeCounter';

const nativeModule = (NativeModules as { RNKeepAwake?: ScreenWake })
  .RNKeepAwake;

/**
 * The app's one keep-awake counter. A build without the module (a test
 * double left unset) keeps the screen's normal timeout rather than crashing
 * the screen that asked.
 */
export const keepAwake = createKeepAwakeCounter({
  activate: () => nativeModule?.activate(),
  deactivate: () => nativeModule?.deactivate(),
});
