import {
  classifyLoginError,
  describeLoginError,
  LOGIN_FAILURES,
  type LoginFailure,
} from './loginErrorClassification';

function serverError(message: unknown): unknown {
  return { response: { data: { message } } };
}

describe('loginErrorClassification', () => {
  describe('classifyLoginError', () => {
    it('reads an Axios error with no response as offline', () => {
      expect(classifyLoginError({ isAxiosError: true })).toBe('offline');
    });

    it('reads an ERR_NETWORK code as offline', () => {
      expect(classifyLoginError({ code: 'ERR_NETWORK' })).toBe('offline');
    });

    it('reads "Incorrect email or password!" as wrong credentials', () => {
      expect(
        classifyLoginError(serverError('Incorrect email or password!')),
      ).toBe('wrong-credentials');
    });

    it('reads "Email not verified" as unverified', () => {
      expect(classifyLoginError(serverError('Email not verified'))).toBe(
        'unverified',
      );
    });

    it('reads "Account disabled" as disabled (GitHub Issue #911 acceptance criterion)', () => {
      expect(classifyLoginError(serverError('Account disabled'))).toBe(
        'disabled',
      );
    });

    it('matches the backend message case-insensitively', () => {
      expect(classifyLoginError(serverError('ACCOUNT DISABLED'))).toBe(
        'disabled',
      );
    });

    it('reads a classified code that cannot answer a login as unknown', () => {
      expect(
        classifyLoginError(
          serverError('Email already registered. Please log in.'),
        ),
      ).toBe('unknown');
    });

    it.each([
      ['an unrecognised message', serverError('Some random error message')],
      ['a message that is not a string', serverError(123)],
      ['a response with no message', { response: { data: {} } }],
      ['a null body', { response: { data: null } }],
      ['no response at all', {}],
    ])('reads %s as unknown', (_label, err) => {
      expect(classifyLoginError(err)).toBe('unknown');
    });
  });

  describe('describeLoginError', () => {
    it('puts wrong credentials under the password field, in the drawn words', () => {
      expect(
        describeLoginError(serverError('Incorrect email or password!')),
      ).toEqual({
        message:
          'That email and password don’t match. Check both and try again.',
        placement: 'password',
        mark: 'error',
      });
    });

    it('shows an unverified email as an amber notice', () => {
      expect(describeLoginError(serverError('Email not verified'))).toEqual({
        message: 'Verify your email from the link we sent, then sign in.',
        placement: 'notice',
        mark: 'warning',
      });
    });

    it('shows a Disabled User as a red-marked notice', () => {
      expect(describeLoginError(serverError('Account disabled'))).toEqual({
        message: 'This account has been disabled, so it can’t sign in.',
        placement: 'notice',
        mark: 'error',
      });
    });

    it('shows a network failure as the offline notice', () => {
      expect(describeLoginError({ code: 'ERR_NETWORK' })).toEqual({
        message: 'You’re offline. Connect to the internet to sign in.',
        placement: 'notice',
        mark: 'warning',
      });
    });

    it('never shows the raw backend text', () => {
      const { message } = describeLoginError(
        serverError('Some random error message'),
      );
      expect(message).toBe(LOGIN_FAILURES.unknown.message);
      expect(message).not.toContain('random');
    });
  });

  describe('LOGIN_FAILURES', () => {
    it('gives every failure its own sentence', () => {
      const messages = Object.values(LOGIN_FAILURES).map((f) => f.message);
      expect(new Set(messages).size).toBe(messages.length);
    });

    it('puts only wrong credentials on the field', () => {
      const onField = (Object.keys(LOGIN_FAILURES) as LoginFailure[]).filter(
        (failure) => LOGIN_FAILURES[failure].placement === 'password',
      );
      expect(onField).toEqual(['wrong-credentials']);
    });
  });
});
