import { toAuthError, toAuthErrorFromMessage } from './auth-error-mapping';

/**
 * The backend's own rejection strings. Classification is message-based, so
 * these are the contract — copied from the handlers that emit them rather than
 * paraphrased, because a paraphrase here would test nothing.
 */
const BACKEND_MESSAGES = {
  wrongCredentials: 'Incorrect email or password!', // utils/passport.ts
  unverified: 'Email not verified. Please verify your email first.', // routes/auth.ts
  alreadyRegistered: 'Email already registered. Please log in.', // AuthController
  resent:
    "Email already registered but isn't verified yet. We've resent the verification email.",
} as const;

describe('auth error mapping', () => {
  describe('credential rejection', () => {
    // Classification required the word 'invalid', which the backend never
    // sends — so every wrong password was reported as 'unknown'.
    it('should classify the backend wrong-credentials message', () => {
      expect(
        toAuthErrorFromMessage(BACKEND_MESSAGES.wrongCredentials).code,
      ).toBe('invalid_credentials');
    });

    it('should classify the message regardless of case', () => {
      expect(toAuthErrorFromMessage('INCORRECT EMAIL OR PASSWORD!').code).toBe(
        'invalid_credentials',
      );
    });

    it('should still classify an invalid-credentials phrasing', () => {
      expect(toAuthErrorFromMessage('Invalid credentials').code).toBe(
        'invalid_credentials',
      );
    });

    it('should still classify an invalid-password phrasing', () => {
      expect(toAuthErrorFromMessage('Invalid password supplied').code).toBe(
        'invalid_credentials',
      );
    });
  });

  describe('other backend messages keep their codes', () => {
    it('should classify the unverified-email rejection', () => {
      expect(toAuthErrorFromMessage(BACKEND_MESSAGES.unverified).code).toBe(
        'email_not_verified',
      );
    });

    it('should classify an already-registered email', () => {
      expect(
        toAuthErrorFromMessage(BACKEND_MESSAGES.alreadyRegistered).code,
      ).toBe('email_already_registered');
    });

    it('should classify a verification resend', () => {
      expect(toAuthErrorFromMessage(BACKEND_MESSAGES.resent).code).toBe(
        'verification_resent',
      );
    });

    it('should classify a network failure', () => {
      expect(toAuthErrorFromMessage('Network Error').code).toBe(
        'network_error',
      );
    });

    it('should fall back to unknown for an unrecognised message', () => {
      expect(toAuthErrorFromMessage('Teapot').code).toBe('unknown');
    });
  });

  describe('toAuthError', () => {
    it('should classify from an Error instance and keep its message', () => {
      const error = toAuthError(new Error(BACKEND_MESSAGES.wrongCredentials));

      expect(error.code).toBe('invalid_credentials');
      expect(error.message).toBe(BACKEND_MESSAGES.wrongCredentials);
    });

    it('should fall back to a generic message for a non-Error value', () => {
      const error = toAuthError('a bare string');

      expect(error.code).toBe('unknown');
      expect(error.message).toBe('Unexpected error.');
    });
  });
});
