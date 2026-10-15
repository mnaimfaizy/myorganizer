import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  createUserDeletion,
  USER_DELETION_CONFIRMATION,
  type UserDeletionDeps,
} from './userDeletion';

const PASSWORD = 'correct-pass';

/** An Axios error the server answered with `status`. */
function answered(status: number): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { message: 'refused' },
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response,
  );
}

/** An Axios error for a request that got no answer at all. */
function unanswered(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, {
    headers: {},
  } as InternalAxiosRequestConfig);
}

/** Fresh collaborators per test, all resolving unless overridden. */
function deps(overrides: Partial<UserDeletionDeps> = {}) {
  const calls: string[] = [];
  const d: UserDeletionDeps = {
    requestDeletion: jest.fn(async () => {
      calls.push('request');
    }),
    clearLocalData: jest.fn(async () => {
      calls.push('clear');
    }),
    endSession: jest.fn(async () => {
      calls.push('end');
    }),
    ...overrides,
  };
  return { d, calls };
}

describe('createUserDeletion', () => {
  it('sends the password with the DELETE confirmation, then wipes the device and ends the Session, in that order', async () => {
    const { d, calls } = deps();

    await expect(createUserDeletion(d)(PASSWORD)).resolves.toBeUndefined();

    expect(d.requestDeletion).toHaveBeenCalledTimes(1);
    expect(d.requestDeletion).toHaveBeenCalledWith({
      password: PASSWORD,
      confirmation: 'DELETE',
    });
    expect(d.clearLocalData).toHaveBeenCalledTimes(1);
    expect(d.endSession).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['request', 'clear', 'end']);
    expect(
      (d.requestDeletion as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan((d.clearLocalData as jest.Mock).mock.invocationCallOrder[0]);
    expect(
      (d.clearLocalData as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan((d.endSession as jest.Mock).mock.invocationCallOrder[0]);
  });

  it.each([
    ['a wrong password (403)', answered(403)],
    ['a running YouTube sync (409)', answered(409)],
    ['a build below the Version Floor (426)', answered(426)],
    ['no answer from the server', unanswered()],
  ])(
    'when the request is refused by %s, rejects with that error and leaves the device as it was',
    async (_name, refusal) => {
      const { d } = deps({
        requestDeletion: jest.fn(async () => {
          throw refusal;
        }),
      });

      await expect(createUserDeletion(d)(PASSWORD)).rejects.toBe(refusal);

      expect(d.clearLocalData).not.toHaveBeenCalled();
      expect(d.endSession).not.toHaveBeenCalled();
    },
  );

  it('still ends the Session when the local wipe fails, and resolves', async () => {
    const { d, calls } = deps({
      clearLocalData: jest.fn(async () => {
        throw new Error('keychain locked');
      }),
    });

    await expect(createUserDeletion(d)(PASSWORD)).resolves.toBeUndefined();

    expect(d.endSession).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['request', 'end']);
  });

  it('does not resolve until the Session has ended', async () => {
    let finishSession!: () => void;
    const { d } = deps({
      endSession: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishSession = resolve;
          }),
      ),
    });

    let settled = false;
    const run = createUserDeletion(d)(PASSWORD).then(() => {
      settled = true;
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(d.endSession).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishSession();
    await run;
    expect(settled).toBe(true);
  });
});

describe('USER_DELETION_CONFIRMATION', () => {
  it('is the DELETE word the server requires', () => {
    expect(USER_DELETION_CONFIRMATION).toBe('DELETE');
  });
});
