import {
  describeLoginError,
  LOGIN_ERROR_MESSAGES,
  DEFAULT_LOGIN_ERROR_MESSAGE,
  LOGIN_NETWORK_ERROR_MESSAGE,
} from './loginErrorClassification';

describe('loginErrorClassification', () => {
  describe('describeLoginError', () => {
    it('returns LOGIN_NETWORK_ERROR_MESSAGE when isNetworkError(err) is true', () => {
      const networkErr = { isAxiosError: true };
      expect(describeLoginError(networkErr)).toBe(LOGIN_NETWORK_ERROR_MESSAGE);
    });

    it('returns LOGIN_NETWORK_ERROR_MESSAGE for ERR_NETWORK code', () => {
      const networkErr = { code: 'ERR_NETWORK' };
      expect(describeLoginError(networkErr)).toBe(LOGIN_NETWORK_ERROR_MESSAGE);
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE when there is no server message', () => {
      const err = {
        response: {
          data: {},
        },
      };
      expect(describeLoginError(err)).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE when response is missing', () => {
      const err = {};
      expect(describeLoginError(err)).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('returns LOGIN_ERROR_MESSAGES[invalid_credentials] for "Incorrect email or password!" message', () => {
      const err = {
        response: {
          data: {
            message: 'Incorrect email or password!',
          },
        },
      };
      expect(describeLoginError(err)).toBe(
        LOGIN_ERROR_MESSAGES['invalid_credentials'],
      );
      expect(describeLoginError(err)).toBe('Incorrect email or password.');
    });

    it('returns LOGIN_ERROR_MESSAGES[email_not_verified] for "Email not verified" message', () => {
      const err = {
        response: {
          data: {
            message: 'Email not verified',
          },
        },
      };
      expect(describeLoginError(err)).toBe(
        LOGIN_ERROR_MESSAGES['email_not_verified'],
      );
      expect(describeLoginError(err)).toBe(
        'Verify your email before signing in.',
      );
    });

    it('returns the disabled account message for "Account disabled" (GitHub Issue #911 acceptance criterion)', () => {
      const err = {
        response: {
          data: {
            message: 'Account disabled',
          },
        },
      };
      const result = describeLoginError(err);
      expect(result).toBe(LOGIN_ERROR_MESSAGES['account_disabled']);
      expect(result).toBe(
        'This account has been disabled. Contact support for help.',
      );
      // Verify it is NOT the default message
      expect(result).not.toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE for a classified-but-unmapped code (email_already_registered)', () => {
      const err = {
        response: {
          data: {
            message: 'Email already registered. Please log in.',
          },
        },
      };
      const result = describeLoginError(err);
      expect(result).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
      // Verify it classifies but is not in the map
      expect(result).not.toBe('Incorrect email or password.');
      expect(result).not.toBe('Verify your email before signing in.');
      expect(result).not.toBe(
        'This account has been disabled. Contact support for help.',
      );
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE for an unknown classified code', () => {
      const err = {
        response: {
          data: {
            message: 'Some random error message',
          },
        },
      };
      expect(describeLoginError(err)).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE when message is not a string', () => {
      const err = {
        response: {
          data: {
            message: 123,
          },
        },
      };
      expect(describeLoginError(err)).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('returns DEFAULT_LOGIN_ERROR_MESSAGE when data is null', () => {
      const err = {
        response: {
          data: null,
        },
      };
      expect(describeLoginError(err)).toBe(DEFAULT_LOGIN_ERROR_MESSAGE);
    });

    it('handles case-insensitive message matching', () => {
      const err = {
        response: {
          data: {
            message: 'ACCOUNT DISABLED',
          },
        },
      };
      expect(describeLoginError(err)).toBe(
        'This account has been disabled. Contact support for help.',
      );
    });
  });

  describe('LOGIN_ERROR_MESSAGES constant', () => {
    it('contains exactly three mapped codes', () => {
      const keys = Object.keys(LOGIN_ERROR_MESSAGES);
      expect(keys).toContain('invalid_credentials');
      expect(keys).toContain('email_not_verified');
      expect(keys).toContain('account_disabled');
      expect(keys.length).toBe(3);
    });

    it('maps invalid_credentials to a user-friendly message', () => {
      expect(LOGIN_ERROR_MESSAGES['invalid_credentials']).toBe(
        'Incorrect email or password.',
      );
    });

    it('maps email_not_verified to a user-friendly message', () => {
      expect(LOGIN_ERROR_MESSAGES['email_not_verified']).toBe(
        'Verify your email before signing in.',
      );
    });

    it('maps account_disabled to a user-friendly message', () => {
      expect(LOGIN_ERROR_MESSAGES['account_disabled']).toBe(
        'This account has been disabled. Contact support for help.',
      );
    });
  });

  describe('constant messages', () => {
    it('DEFAULT_LOGIN_ERROR_MESSAGE is a non-empty string', () => {
      expect(typeof DEFAULT_LOGIN_ERROR_MESSAGE).toBe('string');
      expect(DEFAULT_LOGIN_ERROR_MESSAGE.length).toBeGreaterThan(0);
    });

    it('LOGIN_NETWORK_ERROR_MESSAGE is a non-empty string', () => {
      expect(typeof LOGIN_NETWORK_ERROR_MESSAGE).toBe('string');
      expect(LOGIN_NETWORK_ERROR_MESSAGE.length).toBeGreaterThan(0);
    });

    it('all messages are distinct', () => {
      const messages = [
        DEFAULT_LOGIN_ERROR_MESSAGE,
        LOGIN_NETWORK_ERROR_MESSAGE,
        LOGIN_ERROR_MESSAGES['invalid_credentials'],
        LOGIN_ERROR_MESSAGES['email_not_verified'],
        LOGIN_ERROR_MESSAGES['account_disabled'],
      ];
      const uniqueMessages = new Set(messages);
      expect(uniqueMessages.size).toBe(messages.length);
    });
  });
});
