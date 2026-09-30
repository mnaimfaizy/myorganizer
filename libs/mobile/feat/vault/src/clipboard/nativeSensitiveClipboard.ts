// The real Sensitive Clipboard Platform Adapter: `RNSensitiveClipboard`, the
// small native module this slice adds (see the root README's mobile
// dependency note). No maintained React Native clipboard library exposes
// both halves this feature needs — Android's per-copy `EXTRA_IS_SENSITIVE`
// flag (still an open feature request against
// `@react-native-clipboard/clipboard` as of this slice) and iOS's local-only,
// expiring `UIPasteboard` item — so this app carries a few dozen lines of
// platform code instead of a dependency that only does half the job.
//
// Split from ./sensitiveClipboard.ts, which is the interface and the policy,
// so the policy and its tests can import the interface without pulling a
// native module into a Node Jest environment.
import { NativeModules } from 'react-native';
import type {
  SensitiveClipboard,
  SensitiveCopyOutcome,
} from './sensitiveClipboard';

interface RNSensitiveClipboardModule {
  copy(
    value: string,
    sensitive: boolean,
    expiresInSeconds: number,
  ): Promise<void>;
  clearIfOwned(value: string): Promise<void>;
}

const nativeModule = (
  NativeModules as { RNSensitiveClipboard?: RNSensitiveClipboardModule }
).RNSensitiveClipboard;

class NativeSensitiveClipboard implements SensitiveClipboard {
  async copy(value: string, outcome: SensitiveCopyOutcome): Promise<void> {
    // Absent on a platform this native module has not shipped for yet (a
    // simulator build, a test double left unset) — copying nothing beats
    // crashing the screen that asked for it.
    if (nativeModule == null) return;
    await nativeModule.copy(
      value,
      outcome.kind === 'android-sensitive',
      outcome.kind === 'ios-expiring' ? outcome.expiresInSeconds : 0,
    );
  }

  async clearIfOwned(value: string): Promise<void> {
    if (nativeModule == null) return;
    await nativeModule.clearIfOwned(value);
  }
}

/** The Sensitive Clipboard this app runs against on a device. */
export const nativeSensitiveClipboard: SensitiveClipboard =
  new NativeSensitiveClipboard();
