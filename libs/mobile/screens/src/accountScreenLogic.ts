/**
 * Pure logic functions for AccountScreen, extracted for testability.
 * These functions contain no React hooks and run in a node environment.
 */
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

export interface BiometricLabelResult {
  label: string;
  enabled: boolean;
  disabled: boolean;
}

/**
 * Compute the biometric label and enabled state flags from biometric state.
 */
export function computeBiometricLabel(
  biometricState: BiometricState['state'],
): BiometricLabelResult {
  const label =
    biometricState === null
      ? 'Loading...'
      : biometricState === 'on'
        ? 'On'
        : biometricState === 'unsupported'
          ? 'Not available on this device'
          : 'Off';

  const enabled = biometricState === 'on';
  const disabled = biometricState === 'unsupported' || biometricState === 'off';

  return { label, enabled, disabled };
}

export interface DeviceSettings {
  appearance: 'system' | 'light' | 'dark' | unknown;
  autoLockDelay: 'immediately' | '1m' | '5m' | '15m' | unknown;
}

export interface LabelOptions<T> {
  id: string;
  label: string;
  value: T;
}

/**
 * Find the label for a setting value from a list of options.
 * Returns a default label if the value is not found.
 */
export function findSettingLabel<T>(
  value: T | unknown,
  options: LabelOptions<T>[],
  defaultLabel: string,
): string {
  return options.find((opt) => opt.value === value)?.label || defaultLabel;
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
