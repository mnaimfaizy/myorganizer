/**
 * Tests for the shared passphrase policy — the one place this rule is
 * asserted. Do not re-assert "10 characters" anywhere else.
 */

import {
  MIN_PASSPHRASE_LENGTH,
  passphraseSchema,
  newPassphraseSchema,
  changePassphraseSchema,
} from './passphrasePolicy';

describe('passphrase policy', () => {
  describe('MIN_PASSPHRASE_LENGTH constant', () => {
    test('is 10', () => {
      expect(MIN_PASSPHRASE_LENGTH).toBe(10);
    });
  });

  describe('passphraseSchema', () => {
    test('accepts a passphrase with exactly 10 characters', () => {
      const result = passphraseSchema.safeParse('1234567890');
      expect(result.success).toBe(true);
    });

    test('accepts a passphrase with more than 10 characters', () => {
      const result = passphraseSchema.safeParse('1234567890abc');
      expect(result.success).toBe(true);
    });

    test('rejects a passphrase with 9 characters', () => {
      const result = passphraseSchema.safeParse('123456789');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10');
      }
    });

    test('rejects an empty string', () => {
      const result = passphraseSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('newPassphraseSchema', () => {
    test('accepts matching new passphrase and confirmation', () => {
      const result = newPassphraseSchema.safeParse({
        newPassphrase: '1234567890',
        newPassphraseConfirm: '1234567890',
      });
      expect(result.success).toBe(true);
    });

    test('rejects when confirmation does not match passphrase', () => {
      const result = newPassphraseSchema.safeParse({
        newPassphrase: '1234567890',
        newPassphraseConfirm: '0987654321',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const mismatchError = result.error.issues.find((issue) =>
          issue.path.includes('newPassphraseConfirm'),
        );
        expect(mismatchError?.message).toContain('must match');
      }
    });

    test('rejects when passphrase is too short', () => {
      const result = newPassphraseSchema.safeParse({
        newPassphrase: '123456789',
        newPassphraseConfirm: '123456789',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const lengthError = result.error.issues.find((issue) =>
          issue.path.includes('newPassphrase'),
        );
        expect(lengthError?.message).toContain('at least 10');
      }
    });
  });

  describe('changePassphraseSchema', () => {
    test('accepts current and new passphrases that differ and both match the length rule', () => {
      const result = changePassphraseSchema.safeParse({
        currentPassphrase: '1234567890',
        newPassphrase: '0987654321',
        newPassphraseConfirm: '0987654321',
      });
      expect(result.success).toBe(true);
    });

    test('rejects when current passphrase is empty', () => {
      const result = changePassphraseSchema.safeParse({
        currentPassphrase: '',
        newPassphrase: '1234567890',
        newPassphraseConfirm: '1234567890',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const currentError = result.error.issues.find((issue) =>
          issue.path.includes('currentPassphrase'),
        );
        expect(currentError?.message).toContain('current passphrase');
      }
    });

    test('rejects when new passphrase is too short', () => {
      const result = changePassphraseSchema.safeParse({
        currentPassphrase: '1234567890',
        newPassphrase: '123456789',
        newPassphraseConfirm: '123456789',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const lengthError = result.error.issues.find((issue) =>
          issue.path.includes('newPassphrase'),
        );
        expect(lengthError?.message).toContain('at least 10');
      }
    });

    test('rejects when new passphrase confirmation does not match', () => {
      const result = changePassphraseSchema.safeParse({
        currentPassphrase: '1234567890',
        newPassphrase: '0987654321',
        newPassphraseConfirm: '1234567890',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const mismatchError = result.error.issues.find((issue) =>
          issue.path.includes('newPassphraseConfirm'),
        );
        expect(mismatchError?.message).toContain('must match');
      }
    });

    test('rejects when new passphrase equals current passphrase', () => {
      const result = changePassphraseSchema.safeParse({
        currentPassphrase: '1234567890',
        newPassphrase: '1234567890',
        newPassphraseConfirm: '1234567890',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const sameError = result.error.issues.find((issue) =>
          issue.path.includes('newPassphrase'),
        );
        expect(sameError?.message).toContain('different');
      }
    });
  });
});
