import { createClearUserLocalData } from './clearUserLocalData';

// Fresh fakes per test, so no call history carries from one test to the next.
function fakeEffects() {
  return {
    clearRefreshToken: jest.fn<Promise<void>, []>(() => Promise.resolve()),
    removeBiometricMasterKey: jest.fn<Promise<void>, [string]>(() =>
      Promise.resolve(),
    ),
    forgetResumePoint: jest.fn<void, []>(),
  };
}

describe('createClearUserLocalData', () => {
  it("clears the resume point, the refresh token and the user's key for a single user", async () => {
    const effects = fakeEffects();
    const clear = createClearUserLocalData(effects);

    await expect(clear(['user-a'])).resolves.toBeUndefined();

    expect(effects.forgetResumePoint).toHaveBeenCalledTimes(1);
    expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(effects.removeBiometricMasterKey).toHaveBeenCalledTimes(1);
    expect(effects.removeBiometricMasterKey).toHaveBeenCalledWith('user-a');
  });

  it('still clears the refresh token and the user key when the resume point throws synchronously', async () => {
    const effects = fakeEffects();
    const failure = new Error('resume point store threw');
    effects.forgetResumePoint.mockImplementation(() => {
      throw failure;
    });
    const clear = createClearUserLocalData(effects);

    await expect(clear(['user-a'])).rejects.toBe(failure);

    expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(effects.removeBiometricMasterKey).toHaveBeenCalledWith('user-a');
  });

  it('still clears the refresh token and resume point when no users are listed', async () => {
    const effects = fakeEffects();
    const clear = createClearUserLocalData(effects);

    await expect(clear([])).resolves.toBeUndefined();

    expect(effects.forgetResumePoint).toHaveBeenCalledTimes(1);
    expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(effects.removeBiometricMasterKey).not.toHaveBeenCalled();
  });

  it('removes each user key once when the same id is listed twice', async () => {
    const effects = fakeEffects();
    const clear = createClearUserLocalData(effects);

    await clear(['user-a', 'user-b', 'user-a']);

    expect(effects.removeBiometricMasterKey.mock.calls).toEqual([
      ['user-a'],
      ['user-b'],
    ]);
  });

  it('rejects with the first failure in order, while every effect is still attempted', async () => {
    const effects = fakeEffects();
    const errorA = new Error('refresh token store refused');
    const errorB = new Error('biometric key delete refused');
    effects.clearRefreshToken.mockImplementation(() => Promise.reject(errorA));
    effects.removeBiometricMasterKey.mockImplementation((userId) =>
      userId === 'user-a' ? Promise.reject(errorB) : Promise.resolve(),
    );
    const clear = createClearUserLocalData(effects);

    await expect(clear(['user-a', 'user-b'])).rejects.toBe(errorA);

    expect(effects.forgetResumePoint).toHaveBeenCalledTimes(1);
    expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
    expect(effects.removeBiometricMasterKey.mock.calls).toEqual([
      ['user-a'],
      ['user-b'],
    ]);
  });
});
