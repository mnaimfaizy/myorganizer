import {
  APPEARANCE_SEGMENTS,
  AUTO_LOCK_CHOICES,
  autoLockOptions,
  BIOMETRIC_ENABLE_CANCELLED_MESSAGE,
  BIOMETRIC_ENABLE_FAILED_MESSAGE,
  BIOMETRIC_ENABLE_UNSUPPORTED_MESSAGE,
  BIOMETRIC_OFF_SUBTITLE,
  describeBiometricEnable,
  describeBiometricRow,
  displayName,
  formatAppVersion,
  initialsFor,
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
  describe('describeBiometricRow', () => {
    it('names Face ID in the description when it is on, never in the title', () => {
      expect(describeBiometricRow('on', 'face-id', 'ios')).toEqual({
        kind: 'on',
        subtitle:
          'Your key stays on this phone, behind Face ID. Turning it off removes it.',
        icon: 'faceId',
        on: true,
      });
    });

    it('says "your fingerprint" on an Android phone with a sensor', () => {
      const row = describeBiometricRow('on', 'fingerprint', 'android');
      expect(row.subtitle).toBe(
        'Your key stays on this phone, behind your fingerprint. Turning it off removes it.',
      );
      expect(row.icon).toBe('fingerprint');
    });

    it('falls back to the platform wording when the method is unknown', () => {
      expect(describeBiometricRow('on', null, 'android').subtitle).toContain(
        'behind your fingerprint',
      );
      expect(
        describeBiometricRow('on', 'biometrics', 'ios').subtitle,
      ).toContain('behind Face ID');
    });

    it('reads as off with the passphrase line', () => {
      expect(describeBiometricRow('off', 'face-id', 'ios')).toMatchObject({
        kind: 'off',
        subtitle: BIOMETRIC_OFF_SUBTITLE,
        on: false,
      });
    });

    it('points to the platform settings when nothing is enrolled', () => {
      expect(
        describeBiometricRow('unsupported', 'face-id', 'ios'),
      ).toMatchObject({
        kind: 'unavailable',
        subtitle: 'Set up Face ID in iOS Settings to use this.',
        on: false,
      });
      expect(
        describeBiometricRow('unsupported', 'biometrics', 'ios').subtitle,
      ).toBe('Set up Face ID or Touch ID in iOS Settings to use this.');
      expect(
        describeBiometricRow('unsupported', 'fingerprint', 'android').subtitle,
      ).toBe('Set up a fingerprint in Android Settings to use this.');
    });

    it('holds its place without an answer while the keystore is asked', () => {
      expect(describeBiometricRow(null, null, 'ios')).toMatchObject({
        kind: 'loading',
        subtitle: null,
        on: false,
      });
    });
  });

  describe('describeBiometricEnable', () => {
    it('names the check that follows the passphrase', () => {
      expect(describeBiometricEnable('face-id', 'ios')).toBe(
        'Enter your passphrase, then confirm with Face ID. Your key stays on this phone, and your passphrase and Recovery Key keep working.',
      );
      expect(describeBiometricEnable('fingerprint', 'android')).toContain(
        'confirm with your fingerprint',
      );
    });
  });

  describe('autoLockOptions', () => {
    it('lists the four delays in order and marks the default', () => {
      expect(autoLockOptions('5m')).toEqual([
        { value: 'immediately', label: 'Immediately' },
        { value: '1m', label: 'After 1 minute' },
        { value: '5m', label: 'After 5 minutes · default' },
        { value: '15m', label: 'After 15 minutes' },
      ]);
    });

    it('gives the Account row its short form', () => {
      expect(AUTO_LOCK_CHOICES['5m'].row).toBe('After 5 min');
      expect(AUTO_LOCK_CHOICES.immediately.row).toBe('Immediately');
    });
  });

  describe('APPEARANCE_SEGMENTS', () => {
    it('offers System, Light and Dark in that order', () => {
      expect(APPEARANCE_SEGMENTS).toEqual([
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]);
    });
  });

  describe('the header', () => {
    it('shows first and last name and their initials', () => {
      const user = {
        firstName: 'Sam',
        lastName: 'Kelly',
        email: 'sam@example.com',
      };
      expect(displayName(user)).toBe('Sam Kelly');
      expect(initialsFor(user)).toBe('SK');
    });

    it('falls back to the email when the account has no name', () => {
      const user = { firstName: '', lastName: null, email: 'sam@example.com' };
      expect(displayName(user)).toBe('');
      expect(initialsFor(user)).toBe('S');
    });

    it('has a placeholder with no User', () => {
      expect(initialsFor(null)).toBe('?');
    });
  });

  describe('formatAppVersion', () => {
    it('prints the version, then the build in brackets', () => {
      expect(formatAppVersion('1.0', '1')).toBe('1.0 (1)');
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
    it('only a row drawn on removes Biometric Unlock at logout', () => {
      for (const state of ['on', 'off', 'unsupported', null] as const) {
        expect(describeBiometricRow(state, 'face-id', 'ios').on).toBe(
          shouldDisableBiometricOnLogout(state),
        );
      }
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
