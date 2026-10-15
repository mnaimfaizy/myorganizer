import {
  canRequestUserDeletion,
  classifyUserDeletionError,
  describeUserDeletionError,
  USER_DELETION_CONFIRMATION,
  USER_DELETION_FAILURES,
} from './userDeletionLogic';

const PASSWORD = 'correct-pass';

function serverError(status: number, message = 'refused'): unknown {
  return { response: { status, data: { message } } };
}

describe('userDeletionLogic', () => {
  describe('USER_DELETION_CONFIRMATION', () => {
    it('is the DELETE word the server requires', () => {
      expect(USER_DELETION_CONFIRMATION).toBe('DELETE');
    });
  });

  describe('canRequestUserDeletion', () => {
    it.each(['delete', 'Delete', ' DELETE', 'DELETE ', ''])(
      'refuses the request when the confirmation is %p',
      (confirmation) => {
        expect(
          canRequestUserDeletion({ password: PASSWORD, confirmation }),
        ).toBe(false);
      },
    );

    it('refuses the request for an empty password, even with DELETE typed exactly', () => {
      expect(
        canRequestUserDeletion({ password: '', confirmation: 'DELETE' }),
      ).toBe(false);
    });

    it('allows the request only for a password with DELETE typed exactly', () => {
      expect(
        canRequestUserDeletion({ password: PASSWORD, confirmation: 'DELETE' }),
      ).toBe(true);
    });
  });

  describe('classifyUserDeletionError', () => {
    it('reads a 403 as the wrong password', () => {
      expect(classifyUserDeletionError(serverError(403))).toBe(
        'wrong-password',
      );
    });

    it('reads a 409 as a YouTube sync running', () => {
      expect(classifyUserDeletionError(serverError(409))).toBe('sync-running');
    });

    it('reads an Axios error with no response as offline', () => {
      expect(classifyUserDeletionError({ isAxiosError: true })).toBe('offline');
    });

    it.each([426, 500, 422])('reads a %i as unknown', (status) => {
      expect(classifyUserDeletionError(serverError(status))).toBe('unknown');
    });

    it.each([
      ['a plain Error', new Error('boom')],
      ['null', null],
    ])('reads %s as unknown', (_label, err) => {
      expect(classifyUserDeletionError(err)).toBe('unknown');
    });
  });

  describe('describeUserDeletionError', () => {
    it('puts a wrong password under the password field', () => {
      expect(describeUserDeletionError(serverError(403))).toEqual({
        message: 'Incorrect password.',
        placement: 'password',
      });
    });

    it('shows a running sync as a notice asking for another try', () => {
      expect(describeUserDeletionError(serverError(409))).toEqual({
        message:
          'A YouTube sync is running. Try deleting your account again shortly.',
        placement: 'notice',
      });
    });

    it('shows a network failure as the offline notice', () => {
      expect(describeUserDeletionError({ code: 'ERR_NETWORK' })).toEqual({
        message: 'You’re offline. Your account was not deleted.',
        placement: 'notice',
      });
    });

    it('never shows the raw backend text', () => {
      const { message } = describeUserDeletionError(
        serverError(500, 'Internal Server Error'),
      );
      expect(message).toBe(USER_DELETION_FAILURES.unknown.message);
      expect(message).not.toContain('Internal Server Error');
    });
  });
});
