/**
 * Pure logic functions for AccountScreen, extracted for testability.
 * These functions contain no React hooks and run in a node environment.
 */
import type { Appearance, AutoLockDelay } from '@myorganizer/mobile/core';
import type { BiometricMethod } from '@myorganizer/mobile/feat-vault';
import type { IconName } from '@myorganizer/mobile/ui';
import {
  classifyUnlockFailure,
  describeUnlockFailure,
} from './unlockErrorClassification';

/**
 * The part of the Biometric Unlock controller the Account tab uses. It has no
 * passphrase-free `enable`: turning Biometric Unlock on from here always asks
 * for the passphrase again (ADR 0108 decision 1), however recently the Vault
 * was unlocked.
 */
export interface BiometricState {
  state: 'on' | 'off' | 'unsupported' | null;
  enableWithPassphrase: (passphrase: string) => Promise<{ outcome: string }>;
  disable: () => Promise<void>;
}

/** What the enable sheet says when turning Biometric Unlock on did not work. */
export const BIOMETRIC_ENABLE_CANCELLED_MESSAGE =
  'The biometric check was cancelled, so Biometric Unlock is still off.';
export const BIOMETRIC_ENABLE_UNSUPPORTED_MESSAGE =
  'This device has no biometric set up, so Biometric Unlock is still off.';
export const BIOMETRIC_ENABLE_FAILED_MESSAGE =
  "Biometric Unlock couldn't be turned on. Try again.";

/**
 * Turn Biometric Unlock on with the passphrase the User just typed, and say
 * what happened. A wrong passphrase, an offline device, and a server failure
 * read exactly as they do on the Unlock screen.
 */
export async function performBiometricEnable(
  biometric: BiometricState,
  passphrase: string,
): Promise<{
  success: boolean;
  shouldCloseSheet: boolean;
  errorMessage: string | null;
}> {
  const failure = (errorMessage: string) => ({
    success: false,
    shouldCloseSheet: false,
    errorMessage,
  });

  let outcome: string | undefined;
  try {
    outcome = (await biometric.enableWithPassphrase(passphrase))?.outcome;
  } catch (error) {
    return failure(
      describeUnlockFailure(classifyUnlockFailure(error), 'passphrase') ||
        BIOMETRIC_ENABLE_FAILED_MESSAGE,
    );
  }

  switch (outcome) {
    case 'enabled':
      return { success: true, shouldCloseSheet: true, errorMessage: null };
    case 'cancelled':
      return failure(BIOMETRIC_ENABLE_CANCELLED_MESSAGE);
    case 'refused':
      return failure(BIOMETRIC_ENABLE_UNSUPPORTED_MESSAGE);
    default:
      return failure(BIOMETRIC_ENABLE_FAILED_MESSAGE);
  }
}

/**
 * Handle biometric disable operation: call disable().
 * Returns the operation result and any error message.
 */
export async function performBiometricDisable(
  biometric: BiometricState,
): Promise<{
  success: boolean;
  errorMessage: string | null;
}> {
  try {
    await biometric.disable();
    return {
      success: true,
      errorMessage: null,
    };
  } catch {
    // Note: disable() can throw, but we still complete the operation
    // in the finally block of the React component
    return {
      success: false,
      errorMessage: 'Failed to disable biometric unlock',
    };
  }
}

/**
 * Determine if biometric should be disabled before logout.
 */
export function shouldDisableBiometricOnLogout(
  biometricState: BiometricState['state'],
): boolean {
  return biometricState === 'on';
}

// --- Account copy and choices (6 · Account) -------------------------------

/** The platform whose words a line uses — "iOS Settings", "Android Settings". */
export type AccountPlatform = 'ios' | 'android';

/** How the Biometric Unlock row reads, and whether its switch is drawn on. */
export interface BiometricRowCopy {
  /**
   * `loading` until the keystore has answered, so the row can hold the
   * switch's place without showing an answer it does not have yet.
   */
  kind: 'loading' | 'on' | 'off' | 'unavailable';
  subtitle: string | null;
  icon: IconName;
  on: boolean;
}

/**
 * What each Biometric Method is called, pinned to the method set so a new one
 * cannot reach the Account row without its words (ADR 0053). `behind` finishes
 * "Your key stays on this phone, behind …"; `setUp` is what the User is sent to
 * enrol when the device has none. `null` for `biometrics`: a device that could
 * not say which it has gets the platform's own wording instead.
 */
const BIOMETRIC_METHOD_COPY = {
  'face-id': {
    name: 'Face ID',
    behind: 'Face ID',
    setUp: 'Face ID',
    icon: 'faceId',
  },
  'touch-id': {
    name: 'Touch ID',
    behind: 'Touch ID',
    setUp: 'Touch ID',
    icon: 'fingerprint',
  },
  fingerprint: {
    name: 'your fingerprint',
    behind: 'your fingerprint',
    setUp: 'a fingerprint',
    icon: 'fingerprint',
  },
  biometrics: { name: null, behind: null, setUp: null, icon: null },
} as const satisfies Record<
  BiometricMethod,
  {
    name: string | null;
    behind: string | null;
    setUp: string | null;
    icon: IconName | null;
  }
>;

/**
 * A platform's words for a biometric it cannot name. On iOS a device with
 * nothing enrolled reports no type at all, so the line names both methods.
 */
const PLATFORM_BIOMETRIC_COPY = {
  ios: {
    name: 'Face ID',
    behind: 'Face ID',
    setUp: 'Face ID or Touch ID',
    settings: 'iOS Settings',
    icon: 'faceId',
  },
  android: {
    name: 'your fingerprint',
    behind: 'your fingerprint',
    setUp: 'a fingerprint',
    settings: 'Android Settings',
    icon: 'fingerprint',
  },
} as const satisfies Record<
  AccountPlatform,
  {
    name: string;
    behind: string;
    setUp: string;
    settings: string;
    icon: IconName;
  }
>;

function methodWords(
  method: BiometricMethod | null,
  platform: AccountPlatform,
): { name: string; behind: string; setUp: string; icon: IconName } {
  const fallback = PLATFORM_BIOMETRIC_COPY[platform];
  const own = BIOMETRIC_METHOD_COPY[method ?? 'biometrics'];
  return {
    name: own.name ?? fallback.name,
    behind: own.behind ?? fallback.behind,
    setUp: own.setUp ?? fallback.setUp,
    icon: own.icon ?? fallback.icon,
  };
}

export const BIOMETRIC_OFF_SUBTITLE = 'Off. You unlock with your passphrase.';

/**
 * The Biometric Unlock row for a state and method: the setting is always
 * called Biometric Unlock, and the method is named only in its description.
 */
export function describeBiometricRow(
  state: BiometricState['state'],
  method: BiometricMethod | null,
  platform: AccountPlatform,
): BiometricRowCopy {
  const words = methodWords(method, platform);
  switch (state) {
    case null:
      return { kind: 'loading', subtitle: null, icon: words.icon, on: false };
    case 'on':
      return {
        kind: 'on',
        subtitle: `Your key stays on this phone, behind ${words.behind}. Turning it off removes it.`,
        icon: words.icon,
        on: true,
      };
    case 'off':
      return {
        kind: 'off',
        subtitle: BIOMETRIC_OFF_SUBTITLE,
        icon: words.icon,
        on: false,
      };
    case 'unsupported':
      return {
        kind: 'unavailable',
        subtitle: `Set up ${words.setUp} in ${PLATFORM_BIOMETRIC_COPY[platform].settings} to use this.`,
        icon: words.icon,
        on: false,
      };
  }
}

/**
 * The enable sheet's body. It names the check the User is about to see, so
 * the biometric prompt that follows the passphrase is expected rather than a
 * surprise.
 */
export function describeBiometricEnable(
  method: BiometricMethod | null,
  platform: AccountPlatform,
): string {
  const { name } = methodWords(method, platform);
  return `Enter your passphrase, then confirm with ${name}. Your key stays on this phone, and your passphrase and Recovery Key keep working.`;
}

/**
 * The Auto-lock choices, in the order the sheet lists them, pinned to the
 * delay set (ADR 0053). `row` is the short form the Account row shows at its
 * edge; `option` is the sheet's full line.
 */
export const AUTO_LOCK_CHOICES = {
  immediately: { row: 'Immediately', option: 'Immediately' },
  '1m': { row: 'After 1 min', option: 'After 1 minute' },
  '5m': { row: 'After 5 min', option: 'After 5 minutes' },
  '15m': { row: 'After 15 min', option: 'After 15 minutes' },
} as const satisfies Record<AutoLockDelay, { row: string; option: string }>;

/** The Auto-lock sheet's lines, one per delay, the default marked as drawn. */
export function autoLockOptions(
  defaultDelay: AutoLockDelay,
): readonly { value: AutoLockDelay; label: string }[] {
  return (Object.keys(AUTO_LOCK_CHOICES) as AutoLockDelay[]).map((value) => ({
    value,
    label:
      value === defaultDelay
        ? `${AUTO_LOCK_CHOICES[value].option} · default`
        : AUTO_LOCK_CHOICES[value].option,
  }));
}

/** The Appearance segments, pinned to the appearance set (ADR 0053). */
const APPEARANCE_LABELS = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
} as const satisfies Record<Appearance, string>;

export const APPEARANCE_SEGMENTS: readonly {
  value: Appearance;
  label: string;
}[] = (Object.keys(APPEARANCE_LABELS) as Appearance[]).map((value) => ({
  value,
  label: APPEARANCE_LABELS[value],
}));

/** The signed-in User as the Account header reads them. */
export interface AccountUser {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

/** First and last name, or nothing when the account carries neither. */
export function displayName(user: AccountUser | null | undefined): string {
  return [user?.firstName, user?.lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
}

/**
 * The avatar's initials: first and last name, else the email's first letter,
 * else nothing to show but a placeholder.
 */
export function initialsFor(user: AccountUser | null | undefined): string {
  const fromName = [user?.firstName, user?.lastName]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('');
  const initials = fromName || (user?.email?.trim().charAt(0) ?? '');
  return initials.slice(0, 2).toUpperCase() || '?';
}

/** The About row's value: marketing version, then build — "1.0 (1)". */
export function formatAppVersion(version: string, build: string): string {
  return `${version} (${build})`;
}
