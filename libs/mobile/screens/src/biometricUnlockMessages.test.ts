import type {
  BiometricUnlockAttempt,
  BiometricEnrolment,
} from '@myorganizer/mobile/feat-vault';
import {
  BIOMETRIC_METHOD_COPY,
  biometricCopyFor,
  describeBiometricAttempt,
  describeEnrolmentFailure,
  BIOMETRIC_FAILED_MESSAGE,
} from './biometricUnlockMessages';

describe('biometricUnlockMessages.ts', () => {
  describe('describeBiometricAttempt', () => {
    it('returns null for unlocked outcome', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'unlocked',
        masterKey: new Uint8Array(32),
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).toBeNull();
    });

    it('returns null for cancelled outcome', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'cancelled',
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).toBeNull();
    });

    it('returns a message for unavailable with invalidated reason', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'unavailable',
        reason: 'invalidated',
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).toBe(
        'Your device’s biometrics changed. Unlock with your passphrase to turn Biometric Unlock back on.',
      );
    });

    it('returns a message for unavailable with stale reason', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'unavailable',
        reason: 'stale',
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).not.toBeNull();
      expect(result).toContain('no longer opens your Vault');
    });

    it('returns a message for unavailable with missing reason', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'unavailable',
        reason: 'missing',
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).not.toBeNull();
      expect(result).toContain('Biometric Unlock isn’t set up');
    });

    it('all unavailable messages are distinct', () => {
      const messages = [
        describeBiometricAttempt({
          outcome: 'unavailable',
          reason: 'invalidated',
        }),
        describeBiometricAttempt({
          outcome: 'unavailable',
          reason: 'stale',
        }),
        describeBiometricAttempt({
          outcome: 'unavailable',
          reason: 'missing',
        }),
      ];

      const uniqueMessages = new Set(messages);
      expect(uniqueMessages.size).toBe(3);
    });

    it('returns BIOMETRIC_FAILED_MESSAGE for failed outcome', () => {
      const attempt: BiometricUnlockAttempt = {
        outcome: 'failed',
        error: new Error('Test error'),
      };

      const result = describeBiometricAttempt(attempt);

      expect(result).toBe(BIOMETRIC_FAILED_MESSAGE);
    });

    it('BIOMETRIC_FAILED_MESSAGE is defined and non-empty', () => {
      expect(BIOMETRIC_FAILED_MESSAGE).toBeDefined();
      expect(BIOMETRIC_FAILED_MESSAGE.length).toBeGreaterThan(0);
    });
  });

  describe('describeEnrolmentFailure', () => {
    it('returns null for enabled outcome', () => {
      const enrolment: BiometricEnrolment = { outcome: 'enabled' };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).toBeNull();
    });

    it('says a cancelled biometric check left Biometric Unlock off', () => {
      const enrolment: BiometricEnrolment = { outcome: 'cancelled' };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).toContain('still off');
    });

    it('returns a message for not-passphrase refusal', () => {
      const enrolment: BiometricEnrolment = {
        outcome: 'refused',
        reason: 'not-passphrase',
      };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).not.toBeNull();
      expect(result).toContain('passphrase unlock');
    });

    it('returns a message for stale-passphrase refusal', () => {
      const enrolment: BiometricEnrolment = {
        outcome: 'refused',
        reason: 'stale-passphrase',
      };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).not.toBeNull();
      expect(result).toContain('took too long');
    });

    it('returns a message for unsupported refusal', () => {
      const enrolment: BiometricEnrolment = {
        outcome: 'refused',
        reason: 'unsupported',
      };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).not.toBeNull();
      expect(result).toContain('no biometric');
    });

    it('returns a message for failed outcome', () => {
      const enrolment: BiometricEnrolment = {
        outcome: 'failed',
        error: new Error('Keystore error'),
      };

      const result = describeEnrolmentFailure(enrolment);

      expect(result).not.toBeNull();
      expect(result).toContain('device');
      expect(result).toContain('store');
    });

    it('all refusal and failure messages are distinct', () => {
      const messages = [
        describeEnrolmentFailure({
          outcome: 'refused',
          reason: 'not-passphrase',
        }),
        describeEnrolmentFailure({
          outcome: 'refused',
          reason: 'stale-passphrase',
        }),
        describeEnrolmentFailure({
          outcome: 'refused',
          reason: 'unsupported',
        }),
        describeEnrolmentFailure({
          outcome: 'failed',
          error: new Error('Test'),
        }),
      ];

      const uniqueMessages = new Set(messages);
      expect(uniqueMessages.size).toBe(4);
    });
  });

  describe('biometricCopyFor', () => {
    it('names Face ID on iOS, in the drawn words', () => {
      expect(biometricCopyFor('face-id')).toEqual({
        unlockLabel: 'Unlock with Face ID',
        icon: 'faceId',
        offerTitle: 'Unlock with Face ID next time?',
        offerBody:
          'Your key stays on this device, protected by Face ID. Your passphrase always works too.',
        cancelled: 'Face ID was cancelled. Try again, or use your passphrase.',
      });
    });

    it('names the fingerprint on Android, in the drawn words', () => {
      const copy = biometricCopyFor('fingerprint');
      expect(copy.unlockLabel).toBe('Unlock with fingerprint');
      expect(copy.icon).toBe('fingerprint');
      expect(copy.offerTitle).toBe('Unlock with fingerprint next time?');
      expect(copy.offerBody).toBe(
        'Your key stays on this device, protected by your fingerprint. Your passphrase always works too.',
      );
    });

    it('names no method until the keystore has said which it has', () => {
      expect(biometricCopyFor(null)).toBe(BIOMETRIC_METHOD_COPY.biometrics);
      expect(biometricCopyFor(null).unlockLabel).toBe('Unlock with biometrics');
    });

    it('says the passphrase still works, whichever the method', () => {
      for (const copy of Object.values(BIOMETRIC_METHOD_COPY)) {
        expect(copy.offerBody).toContain('Your passphrase always works too.');
      }
    });

    it('gives every method its own button label', () => {
      const labels = Object.values(BIOMETRIC_METHOD_COPY).map(
        (copy) => copy.unlockLabel,
      );
      expect(new Set(labels).size).toBe(labels.length);
    });
  });
});
