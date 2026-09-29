import {
  isNetworkError,
  extractServerMessage,
  httpStatus,
} from './httpErrorShape';

describe('httpErrorShape', () => {
  describe('isNetworkError', () => {
    it('returns true when no response and isAxiosError === true', () => {
      const err = { isAxiosError: true };
      expect(isNetworkError(err)).toBe(true);
    });

    it('returns true when no response and code === ERR_NETWORK', () => {
      const err = { code: 'ERR_NETWORK' };
      expect(isNetworkError(err)).toBe(true);
    });

    it('returns false when response exists, even with isAxiosError === true', () => {
      const err = { response: { status: 500 }, isAxiosError: true };
      expect(isNetworkError(err)).toBe(false);
    });

    it('returns false when response exists, even with code === ERR_NETWORK', () => {
      const err = { response: { status: 500 }, code: 'ERR_NETWORK' };
      expect(isNetworkError(err)).toBe(false);
    });

    it('returns false when neither isAxiosError nor ERR_NETWORK code is present', () => {
      const err = { someOtherProp: 'value' };
      expect(isNetworkError(err)).toBe(false);
    });

    it('returns false when isAxiosError is false', () => {
      const err = { isAxiosError: false };
      expect(isNetworkError(err)).toBe(false);
    });

    it('returns false when passed null or undefined', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it('returns false when passed a string or number', () => {
      expect(isNetworkError('error')).toBe(false);
      expect(isNetworkError(42)).toBe(false);
    });
  });

  describe('extractServerMessage', () => {
    it('returns the message when response.data.message is a string', () => {
      const err = {
        response: {
          data: {
            message: 'Invalid credentials',
          },
        },
      };
      expect(extractServerMessage(err)).toBe('Invalid credentials');
    });

    it('returns null when message is missing', () => {
      const err = {
        response: {
          data: {},
        },
      };
      expect(extractServerMessage(err)).toBe(null);
    });

    it('returns null when message is not a string', () => {
      const err = {
        response: {
          data: {
            message: 123,
          },
        },
      };
      expect(extractServerMessage(err)).toBe(null);
    });

    it('returns null when data is not an object', () => {
      const err = {
        response: {
          data: 'some string',
        },
      };
      expect(extractServerMessage(err)).toBe(null);
    });

    it('returns null when response is missing', () => {
      const err = {
        someOtherProp: 'value',
      };
      expect(extractServerMessage(err)).toBe(null);
    });

    it('returns null when passed null or undefined', () => {
      expect(extractServerMessage(null)).toBe(null);
      expect(extractServerMessage(undefined)).toBe(null);
    });

    it('returns null when message is an empty string', () => {
      // This is a valid string, so it returns it
      const err = {
        response: {
          data: {
            message: '',
          },
        },
      };
      expect(extractServerMessage(err)).toBe('');
    });

    it('returns the message even when data has other properties', () => {
      const err = {
        response: {
          data: {
            message: 'Account disabled',
            code: 'ACCOUNT_DISABLED',
            timestamp: '2024-01-01',
          },
        },
      };
      expect(extractServerMessage(err)).toBe('Account disabled');
    });
  });

  describe('httpStatus', () => {
    it('returns the status number when response.status is a number', () => {
      const err = {
        response: {
          status: 404,
        },
      };
      expect(httpStatus(err)).toBe(404);
    });

    it('returns undefined when status is missing', () => {
      const err = {
        response: {},
      };
      expect(httpStatus(err)).toBe(undefined);
    });

    it('returns undefined when status is not a number', () => {
      const err = {
        response: {
          status: '404',
        },
      };
      expect(httpStatus(err)).toBe(undefined);
    });

    it('returns undefined when response is missing', () => {
      const err = {
        someOtherProp: 'value',
      };
      expect(httpStatus(err)).toBe(undefined);
    });

    it('returns undefined when passed null or undefined', () => {
      expect(httpStatus(null)).toBe(undefined);
      expect(httpStatus(undefined)).toBe(undefined);
    });

    it('returns 0 when status is 0', () => {
      // 0 is a valid HTTP status (though not common)
      const err = {
        response: {
          status: 0,
        },
      };
      expect(httpStatus(err)).toBe(0);
    });

    it('returns common HTTP status codes correctly', () => {
      expect(httpStatus({ response: { status: 200 } })).toBe(200);
      expect(httpStatus({ response: { status: 401 } })).toBe(401);
      expect(httpStatus({ response: { status: 404 } })).toBe(404);
      expect(httpStatus({ response: { status: 500 } })).toBe(500);
    });
  });
});
