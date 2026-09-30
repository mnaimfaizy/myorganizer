import type {
  BiometricEnrolment,
  BiometricMethod,
  BiometricUnlockAttempt,
} from '@myorganizer/mobile/feat-vault';
import type { IconName } from '@myorganizer/mobile/ui';

/** Everything the Entry screens say that depends on which biometric it is. */
export interface BiometricMethodCopy {
  /** The Unlock screen's hero button. */
  unlockLabel: string;
  /** Its glyph — the method's own mark, drawn beside the label. */
  icon: IconName;
  /** The offer sheet's question. */
  offerTitle: string;
  /** The offer sheet's one line on what turning it on means. */
  offerBody: string;
  /** The quiet line under the hero button after the User dismissed the prompt. */
  cancelled: string;
}

/**
 * The words and mark for each biometric the keystore can report, pinned to
 * the method set so a new method cannot reach a screen without them
 * (ADR 0053). The Entry sheets draw Face ID on iOS and fingerprint on Android;
 * `touch-id` and the unnamed `biometrics` follow the same sentences.
 *
 * The setting is always called Biometric Unlock; the method names the button
 * and the prompt, never the feature (#908).
 */
export const BIOMETRIC_METHOD_COPY = {
  'face-id': {
    unlockLabel: 'Unlock with Face ID',
    icon: 'faceId',
    offerTitle: 'Unlock with Face ID next time?',
    offerBody:
      'Your key stays on this device, protected by Face ID. Your passphrase always works too.',
    cancelled: 'Face ID was cancelled. Try again, or use your passphrase.',
  },
  'touch-id': {
    unlockLabel: 'Unlock with Touch ID',
    icon: 'fingerprint',
    offerTitle: 'Unlock with Touch ID next time?',
    offerBody:
      'Your key stays on this device, protected by Touch ID. Your passphrase always works too.',
    cancelled: 'Touch ID was cancelled. Try again, or use your passphrase.',
  },
  fingerprint: {
    unlockLabel: 'Unlock with fingerprint',
    icon: 'fingerprint',
    offerTitle: 'Unlock with fingerprint next time?',
    offerBody:
      'Your key stays on this device, protected by your fingerprint. Your passphrase always works too.',
    cancelled:
      'The fingerprint check was cancelled. Try again, or use your passphrase.',
  },
  biometrics: {
    unlockLabel: 'Unlock with biometrics',
    icon: 'biometric',
    offerTitle: 'Unlock with biometrics next time?',
    offerBody:
      'Your key stays on this device, protected by your biometrics. Your passphrase always works too.',
    cancelled:
      'The biometric check was cancelled. Try again, or use your passphrase.',
  },
} as const satisfies Record<BiometricMethod, BiometricMethodCopy>;

/**
 * The copy for `method`, or the unnamed one while the keystore has not said
 * which biometric it has — a button that names Face ID on a fingerprint phone
 * is read as the wrong control.
 */
export function biometricCopyFor(
  method: BiometricMethod | null,
): BiometricMethodCopy {
  return BIOMETRIC_METHOD_COPY[method ?? 'biometrics'];
}

/** The endings that leave Biometric Unlock gone for this User on this device. */
export type BiometricUnavailableReason = Extract<
  BiometricUnlockAttempt,
  { outcome: 'unavailable' }
>['reason'];

export const BIOMETRIC_FAILED_MESSAGE =
  'Biometric Unlock didn’t work. Unlock with your passphrase.';

/**
 * What the Unlock screen says when Biometric Unlock has just gone away, pinned
 * to the reasons the policy can produce so a fourth one cannot be added
 * without a sentence for it (ADR 0053).
 *
 * `invalidated` is the sheet's own line (Entry · Unlock · Biometric no longer
 * valid). The other two follow its shape: what happened, then what to do. The
 * first halves differ because the three are not the same event to the User:
 * one is something they did to the device, one is something that happened to
 * their Vault, and one is a feature that was simply not on.
 */
const UNAVAILABLE_MESSAGES = {
  invalidated:
    'Your device’s biometrics changed. Unlock with your passphrase to turn Biometric Unlock back on.',
  stale:
    'The key on this phone no longer opens your Vault. Unlock with your passphrase to turn Biometric Unlock back on.',
  missing:
    'Biometric Unlock isn’t set up on this phone. Unlock with your passphrase.',
} as const satisfies Record<BiometricUnavailableReason, string>;

/** Why turning Biometric Unlock on was refused before anything was written. */
export type BiometricRefusalReason = Extract<
  BiometricEnrolment,
  { outcome: 'refused' }
>['reason'];

/**
 * What the offer says when enrolling did not happen, pinned to the policy's
 * own refusal vocabulary and to its one failure outcome so a new reason cannot
 * be added without a sentence for it (ADR 0053).
 *
 * The three refusals are not one message, because they are not one situation:
 * one is the device declining, one is the passphrase having gone stale while
 * the sheet sat open, and one should never reach a User at all — the sheet
 * asks the same policy before it offers, so a `not-passphrase` here means the
 * unlock changed underneath it.
 */
const ENROLMENT_FAILURE_MESSAGES = {
  'not-passphrase':
    'Biometric Unlock can only be turned on right after a passphrase unlock.',
  'stale-passphrase':
    'That took too long. Unlock with your passphrase again to turn this on.',
  unsupported: 'This device has no biometric this app can use.',
  failed:
    'This device would not store the key. Your passphrase still works — nothing has changed.',
  cancelled:
    'The biometric check was cancelled, so Biometric Unlock is still off. Try again, or choose Not now.',
} as const satisfies Record<
  BiometricRefusalReason | 'failed' | 'cancelled',
  string
>;

/** What to tell the User about an enrolment that did not happen. */
export function describeEnrolmentFailure(
  enrolment: BiometricEnrolment,
): string | null {
  switch (enrolment.outcome) {
    case 'enabled':
      return null;
    case 'refused':
      return ENROLMENT_FAILURE_MESSAGES[enrolment.reason];
    case 'failed':
      return ENROLMENT_FAILURE_MESSAGES.failed;
    case 'cancelled':
      return ENROLMENT_FAILURE_MESSAGES.cancelled;
  }
}

/**
 * What to show the User about an attempt that did not unlock, or `null` when
 * there is nothing to say.
 *
 * A cancellation is `null` on purpose and is the whole of ADR 0108 decision
 * 2's "the screen waits": a User who dismissed the prompt did so deliberately
 * and is already looking at the passphrase field. Telling them they cancelled
 * is an error message for a non-error.
 */
export function describeBiometricAttempt(
  attempt: BiometricUnlockAttempt,
): string | null {
  switch (attempt.outcome) {
    case 'unlocked':
    case 'cancelled':
      return null;
    case 'unavailable':
      return UNAVAILABLE_MESSAGES[attempt.reason];
    case 'failed':
      return BIOMETRIC_FAILED_MESSAGE;
  }
}
