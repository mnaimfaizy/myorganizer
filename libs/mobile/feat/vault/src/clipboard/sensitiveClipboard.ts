/**
 * The Sensitive Clipboard Platform Adapter (CONTEXT.md's "Platform Adapter"):
 * one interface for copying a value in the way each platform's clipboard
 * privacy model asks for, and for clearing it again only while it is still
 * this app's own copy.
 *
 * Split from ./nativeSensitiveClipboard.ts, which is the real implementation
 * over a native module, so the policy below — which outcome a platform gets,
 * what its confirmation says — is tested against the interface rather than on
 * a device. This file holds no `react-native` import, which is what lets
 * `libs/mobile/feat/vault`'s Jest project — a `node` environment with no
 * native modules — cover it.
 */

/** How long a copy survives on iOS before the system clipboard drops it. */
export const IOS_CLIPBOARD_EXPIRY_SECONDS = 60;

/**
 * Which of the three per-platform behaviours a copy gets, decided once so
 * every caller — the copy itself, the confirmation text, the lock-triggered
 * clear — reads the same answer:
 *
 * - `ios-expiring` — local-only (never reaches another signed-in Apple
 *   device via Universal Clipboard) and dropped by the system after
 *   `expiresInSeconds`.
 * - `android-sensitive` — marked sensitive so Android 13+ hides the system's
 *   own clipboard preview. That preview is the platform's confirmation, so
 *   the app shows none of its own.
 * - `plain` — an ordinary copy, for Android below 13, where nothing hides
 *   the preview and the app's "Copied" toast is the only confirmation there
 *   is.
 */
export type SensitiveCopyOutcome =
  | { kind: 'ios-expiring'; expiresInSeconds: number }
  | { kind: 'android-sensitive' }
  | { kind: 'plain' };

/** The platform facts the outcome is decided from — narrowed to what the
 * decision actually reads, so it can be tested without `react-native`'s own
 * `Platform` module. */
export interface CopyPlatform {
  os: 'ios' | 'android';
  /** Android's API level. Ignored on iOS. */
  androidApiLevel?: number;
}

/** Android 13 (Tiramisu), the version that added `EXTRA_IS_SENSITIVE`. */
const ANDROID_SENSITIVE_CLIPBOARD_API_LEVEL = 33;

/** Which `SensitiveCopyOutcome` a copy on `platform` gets. */
export function sensitiveCopyOutcomeFor(
  platform: CopyPlatform,
): SensitiveCopyOutcome {
  if (platform.os === 'ios') {
    return {
      kind: 'ios-expiring',
      expiresInSeconds: IOS_CLIPBOARD_EXPIRY_SECONDS,
    };
  }
  if (
    (platform.androidApiLevel ?? 0) >= ANDROID_SENSITIVE_CLIPBOARD_API_LEVEL
  ) {
    return { kind: 'android-sensitive' };
  }
  return { kind: 'plain' };
}

/**
 * What the screen says right after a copy, or `null` when the platform's own
 * clipboard preview already says it — showing a toast on top of that would
 * be the same confirmation twice (CLAUDE.md's Details slice spec).
 */
export function copyConfirmationMessage(
  outcome: SensitiveCopyOutcome,
): string | null {
  if (outcome.kind === 'ios-expiring') {
    return `Copied — clears in ${outcome.expiresInSeconds} s`;
  }
  if (outcome.kind === 'android-sensitive') return null;
  return 'Copied';
}

/** The Sensitive Clipboard, as a screen's copy action sees it. */
export interface SensitiveClipboard {
  /** Copies `value` the way `outcome` describes. */
  copy(value: string, outcome: SensitiveCopyOutcome): Promise<void>;
  /**
   * Clears the clipboard, but only while it still holds exactly `value` —
   * this app's own copy. A clipboard holding anything else, including a copy
   * made in another app since, is left untouched.
   */
  clearIfOwned(value: string): Promise<void>;
}
