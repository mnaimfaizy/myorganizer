import { isRefreshRejectedByServer } from './refresh-rejection';

describe('isRefreshRejectedByServer', () => {
  function withStatus(status: unknown): unknown {
    return Object.assign(new Error('Refresh failed'), {
      response: { status },
    });
  }

  it.each([400, 401, 403, 404, 422, 499])(
    'is true when the server refuses the refresh with HTTP %i',
    (status) => {
      expect(isRefreshRejectedByServer(withStatus(status))).toBe(true);
    },
  );

  it.each([408, 429, 500, 502, 503])(
    'is false when the refresh could not be completed (HTTP %i)',
    (status) => {
      expect(isRefreshRejectedByServer(withStatus(status))).toBe(false);
    },
  );

  it('is false for a network failure with no response', () => {
    expect(isRefreshRejectedByServer(new Error('Network Error'))).toBe(false);
  });

  it('is false for a timeout with no response', () => {
    const timeout = Object.assign(new Error('timeout of 0ms exceeded'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });

    expect(isRefreshRejectedByServer(timeout)).toBe(false);
  });

  it('is false for null', () => {
    expect(isRefreshRejectedByServer(null)).toBe(false);
  });

  it('is false for a thrown string', () => {
    expect(isRefreshRejectedByServer('401')).toBe(false);
  });

  it('is false when the status is a string rather than a number', () => {
    expect(isRefreshRejectedByServer({ response: { status: '401' } })).toBe(
      false,
    );
  });
});
