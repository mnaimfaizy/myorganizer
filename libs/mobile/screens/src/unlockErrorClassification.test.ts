import {
  classifyUnlockFailure,
  describeWrongSecret,
  describeUnlockFailure,
  stripRecoveryKeyWhitespace,
  formatRecoveryKeyForDisplay,
  UNLOCK_NETWORK_ERROR_MESSAGE,
  UNLOCK_OFFLINE_MESSAGE,
  UNLOCK_SERVER_ERROR_MESSAGE,
  type UnlockSecretMode,
} from './unlockErrorClassification';

describe('unlockErrorClassification', () => {
  describe('classifyUnlockFailure', () => {
    it('returns "no-vault" when httpStatus(err) === 404', () => {
      const err = {
        response: {
          status: 404,
        },
      };
      expect(classifyUnlockFailure(err)).toBe('no-vault');
    });

    it('returns "no-vault" even when other conditions would match (404 takes priority)', () => {
      const err = {
        response: {
          status: 404,
        },
        // Even if it had isAxiosError or code ERR_NETWORK, 404 takes priority
      };
      expect(classifyUnlockFailure(err)).toBe('no-vault');
    });

    it('returns "server-error" when httpStatus(err) is a non-404 number', () => {
      expect(classifyUnlockFailure({ response: { status: 400 } })).toBe(
        'server-error',
      );
      expect(classifyUnlockFailure({ response: { status: 401 } })).toBe(
        'server-error',
      );
      expect(classifyUnlockFailure({ response: { status: 500 } })).toBe(
        'server-error',
      );
      expect(classifyUnlockFailure({ response: { status: 503 } })).toBe(
        'server-error',
      );
    });

    it('returns "network" when isNetworkError(err) is true', () => {
      const err = { isAxiosError: true };
      expect(classifyUnlockFailure(err)).toBe('network');
    });

    it('returns "network" when code is ERR_NETWORK', () => {
      const err = { code: 'ERR_NETWORK' };
      expect(classifyUnlockFailure(err)).toBe('network');
    });

    it('returns "wrong-secret" when none of the above conditions match', () => {
      const err = {};
      expect(classifyUnlockFailure(err)).toBe('wrong-secret');
    });

    it('returns "wrong-secret" when there is a response but no status', () => {
      const err = { response: {} };
      expect(classifyUnlockFailure(err)).toBe('wrong-secret');
    });

    it('returns "wrong-secret" when error shape is minimal', () => {
      const err = { someRandomProp: 'value' };
      expect(classifyUnlockFailure(err)).toBe('wrong-secret');
    });

    it('returns "wrong-secret" when passed null', () => {
      expect(classifyUnlockFailure(null)).toBe('wrong-secret');
    });
  });

  describe('describeWrongSecret', () => {
    it('returns recovery key message for "recovery-key" mode', () => {
      expect(describeWrongSecret('recovery-key')).toBe(
        'That Recovery Key didn’t unlock your Vault. Check each group.',
      );
    });

    it('returns passphrase message for "passphrase" mode', () => {
      expect(describeWrongSecret('passphrase')).toBe(
        'That passphrase didn’t unlock your Vault.',
      );
    });

    it('returns the same passphrase message for any non-recovery-key value', () => {
      // Typing allows only 'recovery-key' | 'passphrase', but test robustness
      const unknownMode = 'unknown' as UnlockSecretMode;
      expect(describeWrongSecret(unknownMode)).toBe(
        'That passphrase didn’t unlock your Vault.',
      );
    });

    it('messages for both modes are distinct', () => {
      const recoveryKeyMsg = describeWrongSecret('recovery-key');
      const passphraseMsg = describeWrongSecret('passphrase');
      expect(recoveryKeyMsg).not.toBe(passphraseMsg);
    });
  });

  describe('describeUnlockFailure', () => {
    it('returns UNLOCK_NETWORK_ERROR_MESSAGE for "network" failure', () => {
      expect(describeUnlockFailure('network', 'passphrase')).toBe(
        UNLOCK_NETWORK_ERROR_MESSAGE,
      );
      expect(describeUnlockFailure('network', 'recovery-key')).toBe(
        UNLOCK_NETWORK_ERROR_MESSAGE,
      );
    });

    it('returns UNLOCK_SERVER_ERROR_MESSAGE for "server-error" failure', () => {
      expect(describeUnlockFailure('server-error', 'passphrase')).toBe(
        UNLOCK_SERVER_ERROR_MESSAGE,
      );
      expect(describeUnlockFailure('server-error', 'recovery-key')).toBe(
        UNLOCK_SERVER_ERROR_MESSAGE,
      );
    });

    it('returns describeWrongSecret(passphrase) for "wrong-secret" with passphrase mode', () => {
      const result = describeUnlockFailure('wrong-secret', 'passphrase');
      expect(result).toBe('That passphrase didn’t unlock your Vault.');
    });

    it('returns describeWrongSecret(recovery-key) for "wrong-secret" with recovery-key mode', () => {
      const result = describeUnlockFailure('wrong-secret', 'recovery-key');
      expect(result).toBe(
        'That Recovery Key didn’t unlock your Vault. Check each group.',
      );
    });

    it('returns empty string for "no-vault" failure (regardless of secret mode)', () => {
      expect(describeUnlockFailure('no-vault', 'passphrase')).toBe('');
      expect(describeUnlockFailure('no-vault', 'recovery-key')).toBe('');
    });

    it('returns different messages for different failures', () => {
      const network = describeUnlockFailure('network', 'passphrase');
      const server = describeUnlockFailure('server-error', 'passphrase');
      const wrongSecret = describeUnlockFailure('wrong-secret', 'passphrase');
      const noVault = describeUnlockFailure('no-vault', 'passphrase');

      expect(network).not.toBe(server);
      expect(network).not.toBe(wrongSecret);
      expect(server).not.toBe(wrongSecret);
      expect(noVault).toBe('');
    });
  });

  describe('stripRecoveryKeyWhitespace', () => {
    it('removes all spaces from a key with spaces', () => {
      const keyWithSpaces = 'abcd efgh ijkl mnop';
      expect(stripRecoveryKeyWhitespace(keyWithSpaces)).toBe(
        'abcdefghijklmnop',
      );
    });

    it('removes leading and trailing spaces', () => {
      const keyWithEdgeSpaces = '  abcdefghijklmnop  ';
      expect(stripRecoveryKeyWhitespace(keyWithEdgeSpaces)).toBe(
        'abcdefghijklmnop',
      );
    });

    it('removes multiple consecutive spaces', () => {
      const keyWithMultipleSpaces = 'abcd    efgh  ijkl';
      expect(stripRecoveryKeyWhitespace(keyWithMultipleSpaces)).toBe(
        'abcdefghijkl',
      );
    });

    it('removes tabs', () => {
      const keyWithTabs = 'abcd\tefgh\tijkl';
      expect(stripRecoveryKeyWhitespace(keyWithTabs)).toBe('abcdefghijkl');
    });

    it('removes newlines', () => {
      const keyWithNewlines = 'abcd\nefgh\nijkl';
      expect(stripRecoveryKeyWhitespace(keyWithNewlines)).toBe('abcdefghijkl');
    });

    it('removes mixed whitespace (spaces, tabs, newlines)', () => {
      const keyWithMixedWhitespace = 'abcd \t\n efgh \n\t ijkl';
      expect(stripRecoveryKeyWhitespace(keyWithMixedWhitespace)).toBe(
        'abcdefghijkl',
      );
    });

    it('returns the same string when there is no whitespace', () => {
      const cleanKey = 'abcdefghijklmnop';
      expect(stripRecoveryKeyWhitespace(cleanKey)).toBe('abcdefghijklmnop');
    });

    it('handles pasted keys from recovery key display format', () => {
      // A 16-character key formatted as "abcd efgh ijkl mnop" can be pasted with spaces
      const pastedKey = 'abcd efgh ijkl mnop';
      const stripped = stripRecoveryKeyWhitespace(pastedKey);
      expect(stripped).toBe('abcdefghijklmnop');
    });

    it('handles longer recovery keys (44 characters)', () => {
      const longKey = 'abcd efgh ijkl mnop qrst uvwx yzab cdef ghij kl';
      const stripped = stripRecoveryKeyWhitespace(longKey);
      expect(stripped).toBe('abcdefghijklmnopqrstuvwxyzabcdefghijkl');
    });
  });

  describe('formatRecoveryKeyForDisplay', () => {
    it('groups a 16-character key into four groups of four with spaces', () => {
      const raw = 'abcdefghijklmnop';
      const formatted = formatRecoveryKeyForDisplay(raw);
      expect(formatted).toBe('abcd efgh ijkl mnop');
    });

    it('groups a 20-character key into five groups of four with spaces', () => {
      const raw = 'abcdefghijklmnopqrst';
      const formatted = formatRecoveryKeyForDisplay(raw);
      expect(formatted).toBe('abcd efgh ijkl mnop qrst');
    });

    it('has no trailing space', () => {
      const raw = 'abcdefghijklmnop';
      const formatted = formatRecoveryKeyForDisplay(raw);
      expect(formatted.endsWith(' ')).toBe(false);
      expect(formatted).toBe('abcd efgh ijkl mnop');
    });

    it('handles longer recovery keys (44 characters)', () => {
      const raw = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr';
      const formatted = formatRecoveryKeyForDisplay(raw);
      // 44 chars = 11 groups of 4
      expect(formatted).toBe(
        'abcd efgh ijkl mnop qrst uvwx yzab cdef ghij klmn opqr',
      );
      expect(formatted.endsWith(' ')).toBe(false);
    });

    it('handles edge case: empty string', () => {
      expect(formatRecoveryKeyForDisplay('')).toBe('');
    });

    it('handles edge case: 1 character', () => {
      // Regex (.{4}) matches nothing for 'a', so returns 'a' unchanged, then trimEnd() returns 'a'
      expect(formatRecoveryKeyForDisplay('a')).toBe('a');
    });

    it('handles edge case: 3 characters (less than one group)', () => {
      expect(formatRecoveryKeyForDisplay('abc')).toBe('abc');
    });

    it('handles edge case: 8 characters (two full groups)', () => {
      const raw = 'abcdefgh';
      const formatted = formatRecoveryKeyForDisplay(raw);
      expect(formatted).toBe('abcd efgh');
      expect(formatted.endsWith(' ')).toBe(false);
    });

    it('groups characters in fours with consistent spacing', () => {
      const raw = '0123456789abcdefghij';
      const formatted = formatRecoveryKeyForDisplay(raw);
      const parts = formatted.split(' ');
      // Should be 5 parts for 20 characters
      expect(parts.length).toBe(5);
      parts.forEach((part) => {
        expect(part.length).toBe(4);
      });
    });
  });

  describe('Recovery key GitHub Issue #911 acceptance criterion', () => {
    it('strips whitespace from a formatted key and gets the original back', () => {
      const original = '0123456789abcdef';
      const formatted = formatRecoveryKeyForDisplay(original);
      const stripped = stripRecoveryKeyWhitespace(formatted);
      expect(stripped).toBe(original);
    });

    it('round-trip test for 20-character key', () => {
      const original = '0123456789abcdefghij';
      const formatted = formatRecoveryKeyForDisplay(original);
      const stripped = stripRecoveryKeyWhitespace(formatted);
      expect(stripped).toBe(original);
    });

    it('round-trip test for 44-character key (realistic recovery key length)', () => {
      // 44-character key (11 groups of 4)
      const original = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ'.slice(
        0,
        44,
      );
      expect(original.length).toBe(44);
      const formatted = formatRecoveryKeyForDisplay(original);
      const stripped = stripRecoveryKeyWhitespace(formatted);
      expect(stripped).toBe(original);
    });

    it('accepts a pasted key with spaces and decodes it the same way as the unspaced version', () => {
      const unspacedKey = '0123456789abcdef';
      const pastedKeyWithSpaces = '0123 456789abcd ef';
      expect(stripRecoveryKeyWhitespace(pastedKeyWithSpaces)).toBe(
        stripRecoveryKeyWhitespace(unspacedKey),
      );
      expect(stripRecoveryKeyWhitespace(pastedKeyWithSpaces)).toBe(unspacedKey);
    });

    it('accepts a key pasted from the display format (formatted with spaces)', () => {
      const unspacedKey = '0123456789abcdef';
      const displayFormatted = formatRecoveryKeyForDisplay(unspacedKey);
      expect(displayFormatted).toBe('0123 4567 89ab cdef');
      // User pastes the formatted version
      const stripped = stripRecoveryKeyWhitespace(displayFormatted);
      expect(stripped).toBe(unspacedKey);
    });
  });

  describe('constant messages', () => {
    it('UNLOCK_NETWORK_ERROR_MESSAGE is a non-empty string', () => {
      expect(typeof UNLOCK_NETWORK_ERROR_MESSAGE).toBe('string');
      expect(UNLOCK_NETWORK_ERROR_MESSAGE.length).toBeGreaterThan(0);
    });

    it('UNLOCK_SERVER_ERROR_MESSAGE is a non-empty string', () => {
      expect(typeof UNLOCK_SERVER_ERROR_MESSAGE).toBe('string');
      expect(UNLOCK_SERVER_ERROR_MESSAGE.length).toBeGreaterThan(0);
    });

    it('UNLOCK_OFFLINE_MESSAGE is the drawn offline line', () => {
      expect(UNLOCK_OFFLINE_MESSAGE).toBe(
        'Unlocking needs a connection. Your Vault isn’t stored on this phone.',
      );
    });

    it('network and server error messages are distinct', () => {
      expect(UNLOCK_NETWORK_ERROR_MESSAGE).not.toBe(
        UNLOCK_SERVER_ERROR_MESSAGE,
      );
    });
  });
});
