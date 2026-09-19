import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import { runBootTask } from './runBootTask';

describe('runBootTask', () => {
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('awaits task once and resolves without logging when task succeeds', async () => {
    const task = jest
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce(undefined);

    await expect(
      runBootTask('[bootstrap] something failed', task),
    ).resolves.toBeUndefined();

    expect(task).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('swallows rejection and logs failureMessage with the same Error instance', async () => {
    const err = new Error('db down');
    const task = jest.fn<() => Promise<void>>().mockRejectedValueOnce(err);

    await expect(
      runBootTask('[bootstrap] delete superseded todos failed', task),
    ).resolves.toBeUndefined();

    expect(task).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[bootstrap] delete superseded todos failed',
      err,
    );
  });

  test('invokes task exactly once even when it throws', async () => {
    const task = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('boom'));

    await runBootTask('[bootstrap] failed', task);

    expect(task).toHaveBeenCalledTimes(1);
  });
});
