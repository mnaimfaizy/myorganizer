import {
  computeBiometricLabel,
  findSettingLabel,
  performBiometricEnable,
  performBiometricDisable,
  shouldDisableBiometricOnLogout,
  type BiometricState,
} from './accountScreenLogic';

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
    it('returns success when enable() resolves with outcome="enabled"', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue({ outcome: 'enabled' }),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.success).toBe(true);
      expect(result.shouldCloseSheet).toBe(true);
      expect(result.errorMessage).toBeNull();
      expect(mockBiometric.enable).toHaveBeenCalled();
    });

    it('returns failure when enable() resolves with outcome != "enabled"', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue({ outcome: 'denied' }),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.success).toBe(false);
      expect(result.shouldCloseSheet).toBe(false);
      expect(result.errorMessage).toBe('Failed to enable biometric unlock');
    });

    it('returns failure when enable() throws exception', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockRejectedValue(new Error('Device error')),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.success).toBe(false);
      expect(result.shouldCloseSheet).toBe(false);
      expect(result.errorMessage).toBe('Failed to enable biometric unlock');
    });

    it('keeps sheet open when enable fails', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue({ outcome: 'timeout' }),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.shouldCloseSheet).toBe(false);
    });

    it('closes sheet only on success', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue({ outcome: 'enabled' }),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.shouldCloseSheet).toBe(true);
    });

    it('always sets error message on failure', async () => {
      const failure1 = await performBiometricEnable({
        state: 'off',
        enable: jest.fn().mockResolvedValue({ outcome: 'denied' }),
        disable: jest.fn(),
      });
      const failure2 = await performBiometricEnable({
        state: 'off',
        enable: jest.fn().mockRejectedValue(new Error('Unknown')),
        disable: jest.fn(),
      });

      expect(failure1.errorMessage).toBe('Failed to enable biometric unlock');
      expect(failure2.errorMessage).toBe('Failed to enable biometric unlock');
    });
  });

  describe('performBiometricDisable', () => {
    it('returns success when disable() resolves', async () => {
      const mockBiometric: BiometricState = {
        state: 'on',
        enable: jest.fn(),
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
        enable: jest.fn(),
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
        enable: jest.fn(),
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
    it('performBiometricEnable handles enable() returning non-outcome shape', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue({}),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Failed to enable biometric unlock');
    });

    it('performBiometricEnable handles enable() returning null', async () => {
      const mockBiometric: BiometricState = {
        state: 'off',
        enable: jest.fn().mockResolvedValue(null),
        disable: jest.fn(),
      };

      const result = await performBiometricEnable(mockBiometric);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Failed to enable biometric unlock');
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
          enable: jest.fn(),
          disable: jest.fn().mockRejectedValue(error),
        };

        const result = await performBiometricDisable(mockBiometric);

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('Failed to disable biometric unlock');
      }
    });
  });
});
