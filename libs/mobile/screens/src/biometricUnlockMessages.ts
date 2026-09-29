import type {
  BiometricEnrolment,
  BiometricUnlockAttempt,
} from '@myorganizer/mobile/feat-vault';

/** The endings that leave Biometric Unlock gone for this User on this device. */
export type BiometricUnavailableReason = Extract<
  BiometricUnlockAttempt,
  { outcome: 'unavailable' }
>['reason'];

export const BIOMETRIC_FAILED_MESSAGE =
  "Biometric Unlock didn't work. Enter your passphrase to unlock.";

/**
 * What the Unlock screen says when Biometric Unlock has just gone away, pinned
 * to the reasons the policy can produce so a fourth one cannot be added
 * without a sentence for it (ADR 0053).
 *
 * All three say the same second half. The first half differs because the three
 * are not the same event to the User: one is something they did to the device,
 * one is something that happened to their Vault, and one is a feature that was
 * simply not on.
 */
const UNAVAILABLE_MESSAGES = {
  invalidated:
    "Biometric Unlock is off — this device's biometrics changed since you turned it on. Enter your passphrase to unlock.",
  stale:
    'Biometric Unlock is off — the key stored here no longer opens this vault. Enter your passphrase to unlock.',
  missing:
    'Biometric Unlock is not set up on this device. Enter your passphrase to unlock.',
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
