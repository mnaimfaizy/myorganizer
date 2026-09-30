import {
  sensitiveCopyOutcomeFor,
  copyConfirmationMessage,
  IOS_CLIPBOARD_EXPIRY_SECONDS,
  type CopyPlatform,
  type SensitiveCopyOutcome,
} from './sensitiveClipboard';

describe('sensitiveClipboard', () => {
  describe('sensitiveCopyOutcomeFor', () => {
    it('returns ios-expiring outcome for iOS regardless of API level', () => {
      const platform: CopyPlatform = { os: 'ios' };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome.kind).toBe('ios-expiring');
      expect(outcome).toEqual({
        kind: 'ios-expiring',
        expiresInSeconds: 60,
      });
    });

    it('ignores androidApiLevel on iOS', () => {
      const platform: CopyPlatform = {
        os: 'ios',
        androidApiLevel: 35,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome.kind).toBe('ios-expiring');
      expect((outcome as any).expiresInSeconds).toBe(60);
    });

    it('returns ios-expiring with correct expiry seconds constant', () => {
      const platform: CopyPlatform = { os: 'ios' };

      const outcome = sensitiveCopyOutcomeFor(platform);

      if (outcome.kind === 'ios-expiring') {
        expect(outcome.expiresInSeconds).toBe(IOS_CLIPBOARD_EXPIRY_SECONDS);
        expect(IOS_CLIPBOARD_EXPIRY_SECONDS).toBe(60);
      }
    });

    it('returns android-sensitive for Android API level >= 33', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 33,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome).toEqual({ kind: 'android-sensitive' });
    });

    it('returns android-sensitive for Android API level > 33', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 34,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome.kind).toBe('android-sensitive');
    });

    it('returns android-sensitive for current high API levels', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 35,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome.kind).toBe('android-sensitive');
    });

    it('returns plain for Android API level < 33', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 32,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome).toEqual({ kind: 'plain' });
    });

    it('returns plain for Android API level 1', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 1,
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome.kind).toBe('plain');
    });

    it('returns plain when androidApiLevel is undefined on Android', () => {
      const platform: CopyPlatform = { os: 'android' };

      const outcome = sensitiveCopyOutcomeFor(platform);

      expect(outcome).toEqual({ kind: 'plain' });
    });

    it('treats missing androidApiLevel as 0, which is < 33', () => {
      const platform: CopyPlatform = {
        os: 'android',
      };

      const outcome = sensitiveCopyOutcomeFor(platform);

      // Undefined defaults to 0, which is < 33, so plain
      expect(outcome.kind).toBe('plain');
    });
  });

  describe('copyConfirmationMessage', () => {
    it('returns expiry message for ios-expiring outcome', () => {
      const outcome: SensitiveCopyOutcome = {
        kind: 'ios-expiring',
        expiresInSeconds: 60,
      };

      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied — clears in 60 s');
    });

    it('uses the actual expiresInSeconds value in message', () => {
      const outcome: SensitiveCopyOutcome = {
        kind: 'ios-expiring',
        expiresInSeconds: 120,
      };

      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied — clears in 120 s');
    });

    it('returns null for android-sensitive outcome', () => {
      const outcome: SensitiveCopyOutcome = { kind: 'android-sensitive' };

      const message = copyConfirmationMessage(outcome);

      expect(message).toBeNull();
    });

    it('returns "Copied" for plain outcome', () => {
      const outcome: SensitiveCopyOutcome = { kind: 'plain' };

      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied');
    });
  });

  describe('integration: sensitiveCopyOutcomeFor + copyConfirmationMessage', () => {
    it('iOS copy returns expiry confirmation', () => {
      const platform: CopyPlatform = { os: 'ios' };
      const outcome = sensitiveCopyOutcomeFor(platform);
      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied — clears in 60 s');
    });

    it('Android API 33+ copy returns null confirmation (system shows it)', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 33,
      };
      const outcome = sensitiveCopyOutcomeFor(platform);
      const message = copyConfirmationMessage(outcome);

      expect(message).toBeNull();
    });

    it('Android API < 33 copy returns basic Copied confirmation', () => {
      const platform: CopyPlatform = {
        os: 'android',
        androidApiLevel: 30,
      };
      const outcome = sensitiveCopyOutcomeFor(platform);
      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied');
    });

    it('Android API undefined copy returns basic Copied confirmation', () => {
      const platform: CopyPlatform = { os: 'android' };
      const outcome = sensitiveCopyOutcomeFor(platform);
      const message = copyConfirmationMessage(outcome);

      expect(message).toBe('Copied');
    });
  });

  describe('constants', () => {
    it('IOS_CLIPBOARD_EXPIRY_SECONDS is 60', () => {
      expect(IOS_CLIPBOARD_EXPIRY_SECONDS).toBe(60);
    });

    it('IOS_CLIPBOARD_EXPIRY_SECONDS matches ios-expiring outcome', () => {
      const platform: CopyPlatform = { os: 'ios' };
      const outcome = sensitiveCopyOutcomeFor(platform);

      if (outcome.kind === 'ios-expiring') {
        expect(outcome.expiresInSeconds).toBe(IOS_CLIPBOARD_EXPIRY_SECONDS);
      }
    });
  });
});
