import {
  BIOMETRIC_ENABLE_CANCELLED_MESSAGE,
  BIOMETRIC_ENABLE_FAILED_MESSAGE,
  BIOMETRIC_ENABLE_UNSUPPORTED_MESSAGE,
  computeBiometricLabel,
  findSettingLabel,
  performBiometricEnable,
  performBiometricDisable,
  shouldDisableBiometricOnLogout,
  type BiometricState,
} from './accountScreenLogic';
import {
  describeWrongSecret,
  UNLOCK_NETWORK_ERROR_MESSAGE,
} from './unlockErrorClassification';

describe('accountScreenLogic', () => {
  describe('computeBiometricLabel', () => {
    it('returns "Loading..." label when biometric state is null', () => {
      const result = computeBiometricLabel(null);
      expect(result.label).toBe('Loading...');
    });

    it('returns "On" label when biometric state is "on"', () => {
      const result = computeBiometricLabel('on');
      expect(result.label).toBe('On');
    });

    it('returns "Off" label when biometric state is "off"', () => {
      const result = computeBiometricLabel('off');
      expect(result.label).toBe('Off');
    });

    it('sets enabled=true and disabled=false when state is "on"', () => {
      const result = computeBiometricLabel('on');
      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
    });

    it('sets enabled=false and disabled=true when state is "off"', () => {
      const result = computeBiometricLabel('off');
      expect(result.enabled).toBe(false);
      expect(result.disabled).toBe(true);
    });

    it('sets both enabled and disabled to false when state is null', () => {
      const result = computeBiometricLabel(null);
      expect(result.enabled).toBe(false);
      expect(result.disabled).toBe(false);
    });

    it('returns "Not available on this device" label when state is "unsupported"', () => {
      const result = computeBiometricLabel('unsupported');
      expect(result.label).toBe('Not available on this device');
    });

    it('sets enabled=false and disabled=true when state is "unsupported"', () => {
      const result = computeBiometricLabel('unsupported');
      expect(result.enabled).toBe(false);
      expect(result.disabled).toBe(true);
    });

    it('treats unsupported the same as off for disabled flag', () => {
      const offResult = computeBiometricLabel('off');
      const unsupportedResult = computeBiometricLabel('unsupported');
      expect(offResult.disabled).toBe(true);
      expect(unsupportedResult.disabled).toBe(true);
    });
  });

  describe('findSettingLabel', () => {
    const appearanceOptions = [
      { id: 'sys', label: 'System', value: 'system' as const },
      { id: 'light', label: 'Light', value: 'light' as const },
      { id: 'dark', label: 'Dark', value: 'dark' as const },
    ];

    it('finds label for a valid value', () => {
      const result = findSettingLabel('dark', appearanceOptions, 'System');
      expect(result).toBe('Dark');
    });

    it('finds label for system when it exists', () => {
      const result = findSettingLabel('system', appearanceOptions, 'System');
      expect(result).toBe('System');
    });

    it('returns default label when value is not found', () => {
      const result = findSettingLabel(
        'unknown' as unknown,
        appearanceOptions,
        'System',
      );
      expect(result).toBe('System');
    });

    it('returns default label when options are empty', () => {
      const result = findSettingLabel('light', [], 'Default');
      expect(result).toBe('Default');
    });

    it('works with different option types', () => {
      const delayOptions = [
        { id: '1', label: '1 minute', value: '1m' as const },
        { id: '5', label: '5 minutes', value: '5m' as const },
        { id: '15', label: '15 minutes', value: '15m' as const },
      ];

      const result = findSettingLabel('15m', delayOptions, '5 minutes');
      expect(result).toBe('15 minutes');
    });

    it('distinguishes between similar values', () => {
      const options = [
        { id: '1', label: 'One', value: 1 },
        { id: '10', label: 'Ten', value: 10 },
        { id: '100', label: 'Hundred', value: 100 },
      ];

      expect(findSettingLabel(1, options, 'Default')).toBe('One');
      expect(findSettingLabel(10, options, 'Default')).toBe('Ten');
      expect(findSettingLabel(100, options, 'Default')).toBe('Hundred');
    });
  });

  describe('performBiometricEnable', () => {
    const biometricWith = (
      enableWithPassphrase: BiometricState['enableWithPassphrase'],
    ): BiometricState => ({
      state: 'off',
      enableWithPassphrase,
      disable: jest.fn(),
    });

    it('passes the typed passphrase through and closes the sheet on enabled', async () => {
      const enableWithPassphrase = jest
        .fn()
        .mockResolvedValue({ outcome: 'enabled' });

      const result = await performBiometricEnable(
        biometricWith(enableWithPassphrase),
        'correct horse',
      );

      expect(enableWithPassphrase).toHaveBeenCalledWith('correct horse');
      expect(result).toEqual({
        success: true,
        shouldCloseSheet: true,
        errorMessage: null,
      });
    });

    it('says the passphrase was wrong when the Vault refuses it', async () => {
      const result = await performBiometricEnable(
        biometricWith(jest.fn().mockRejectedValue(new Error('auth tag'))),
        'wrong',
      );

      expect(result.success).toBe(false);
      expect(result.shouldCloseSheet).toBe(false);
      expect(result.errorMessage).toBe(describeWrongSecret('passphrase'));
    });

    it('says the device is offline on a transport failure', async () => {
      const offline = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        code: 'ERR_NETWORK',
      });

      const result = await performBiometricEnable(
        biometricWith(jest.fn().mockRejectedValue(offline)),
        'passphrase',
      );

      expect(result.errorMessage).toBe(UNLOCK_NETWORK_ERROR_MESSAGE);
    });

    it('keeps the sheet open and says so when the biometric check is cancelled', async () => {
      const result = await performBiometricEnable(
        biometricWith(jest.fn().mockResolvedValue({ outcome: 'cancelled' })),
        'passphrase',
      );

      expect(result.shouldCloseSheet).toBe(false);
      expect(result.errorMessage).toBe(BIOMETRIC_ENABLE_CANCELLED_MESSAGE);
    });

    it('explains a refusal as no biometric set up', async () => {
      const result = await performBiometricEnable(
        biometricWith(jest.fn().mockResolvedValue({ outcome: 'refused' })),
        'passphrase',
      );

      expect(result.errorMessage).toBe(BIOMETRIC_ENABLE_UNSUPPORTED_MESSAGE);
    });

    it('reports a generic failure for anything else', async () => {
      const result = await performBiometricEnable(
        biometricWith(jest.fn().mockResolvedValue({ outcome: 'failed' })),
        'passphrase',
      );

      expect(result.errorMessage).toBe(BIOMETRIC_ENABLE_FAILED_MESSAGE);
    });
  });

  describe('performBiometricDisable', () => {
    it('returns success when disable() resolves', async () => {
      const mockBiometric: BiometricState = {
        state: 'on',
        enableWithPassphrase: jest.fn(),
        disable: jest.fn().mockResolvedValue(undefined),
      };

      const result = await performBiometricDisable(mockBiometric);

      expect(result.success).toBe(true);
      expect(result.errorMessage).toBeNull();
      expect(mockBiometric.disable).toHaveBeenCalled();
    });

    it('returns failure when disable() throws exception', async () => {
      const mockBiometric: BiometricState = {
        state: 'on',
        enableWithPassphrase: jest.fn(),
        disable: jest.fn().mockRejectedValue(new Error('Device error')),
      };

      const result = await performBiometricDisable(mockBiometric);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Failed to disable biometric unlock');
    });

    it('still attempts disable even if it might fail', async () => {
      const mockDisable = jest
        .fn()
        .mockRejectedValue(new Error('Biometric unavailable'));
      const mockBiometric: BiometricState = {
        state: 'on',
        enableWithPassphrase: jest.fn(),
        disable: mockDisable,
      };

      await performBiometricDisable(mockBiometric);

      expect(mockDisable).toHaveBeenCalled();
    });
  });

  describe('shouldDisableBiometricOnLogout', () => {
    it('returns true when biometric state is "on"', () => {
      const result = shouldDisableBiometricOnLogout('on');
      expect(result).toBe(true);
    });

    it('returns false when biometric state is "off"', () => {
      const result = shouldDisableBiometricOnLogout('off');
      expect(result).toBe(false);
    });

    it('returns false when biometric state is null', () => {
      const result = shouldDisableBiometricOnLogout(null);
      expect(result).toBe(false);
    });

    it('safely handles all three possible biometric states', () => {
      expect(shouldDisableBiometricOnLogout('on')).toBe(true);
      expect(shouldDisableBiometricOnLogout('off')).toBe(false);
      expect(shouldDisableBiometricOnLogout(null)).toBe(false);
    });
  });

  describe('state consistency', () => {
    it('computeBiometricLabel and shouldDisableBiometricOnLogout align on "on" state', () => {
      const labelResult = computeBiometricLabel('on');
      const shouldDisable = shouldDisableBiometricOnLogout('on');

      expect(labelResult.enabled).toBe(true);
      expect(shouldDisable).toBe(true);
    });

    it('computeBiometricLabel and shouldDisableBiometricOnLogout align on "off" state', () => {
      const labelResult = computeBiometricLabel('off');
      const shouldDisable = shouldDisableBiometricOnLogout('off');

      expect(labelResult.enabled).toBe(false);
      expect(shouldDisable).toBe(false);
    });

    it('computeBiometricLabel "Loading..." state implies no disable needed', () => {
      const labelResult = computeBiometricLabel(null);
      const shouldDisable = shouldDisableBiometricOnLogout(null);

      expect(labelResult.label).toBe('Loading...');
      expect(shouldDisable).toBe(false);
    });
  });

  describe('error handling robustness', () => {
    it('performBiometricEnable treats a missing outcome as a failure', async () => {
      for (const resolved of [{}, null]) {
        const result = await performBiometricEnable(
          {
            state: 'off',
            enableWithPassphrase: jest.fn().mockResolvedValue(resolved),
            disable: jest.fn(),
          },
          'passphrase',
        );

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe(BIOMETRIC_ENABLE_FAILED_MESSAGE);
      }
    });

    it('performBiometricDisable handles disable() throwing different error types', async () => {
      const errors = [
        new Error('Device error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
      ];

      for (const error of errors) {
        const mockBiometric: BiometricState = {
          state: 'on',
          enableWithPassphrase: jest.fn(),
          disable: jest.fn().mockRejectedValue(error),
        };

        const result = await performBiometricDisable(mockBiometric);

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('Failed to disable biometric unlock');
      }
    });
  });
});
