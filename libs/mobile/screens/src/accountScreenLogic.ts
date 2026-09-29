/**
 * Pure logic functions for AccountScreen, extracted for testability.
 * These functions contain no React hooks and run in a node environment.
 */

export interface BiometricState {
  state: 'on' | 'off' | 'unsupported' | null;
  enable: () => Promise<{ outcome: 'enabled' | 'denied' | unknown }>;
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

/**
 * Handle biometric enable operation: call enable(), check outcome, update state.
 * Returns the operation result and any error message.
 */
export async function performBiometricEnable(
  biometric: BiometricState,
): Promise<{
  success: boolean;
  shouldCloseSheet: boolean;
  errorMessage: string | null;
}> {
  try {
    const result = await biometric.enable();
    if (result.outcome === 'enabled') {
      return {
        success: true,
        shouldCloseSheet: true,
        errorMessage: null,
      };
    } else {
      return {
        success: false,
        shouldCloseSheet: false,
        errorMessage: 'Failed to enable biometric unlock',
      };
    }
  } catch {
    return {
      success: false,
      shouldCloseSheet: false,
      errorMessage: 'Failed to enable biometric unlock',
    };
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
