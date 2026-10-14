// The settings store reads MMKV, a JSI module that cannot load under node. The
// web variant is the in-memory store with the same interface, so the Device
// Settings test runs against it unchanged.
jest.mock('../settings/settingsStorage', () =>
  jest.requireActual('../settings/settingsStorage.web'),
);

import {
  guardBackendOrigin,
  isBackendOriginUnchanged,
  withLocalDataOwner,
  type BackendOriginRecord,
} from './backendOriginGuard';
import { createClearUserLocalData } from './clearUserLocalData';
import {
  getDeviceSettings,
  markBiometricUnlockOffered,
  setAppearance,
  setAutoLockDelay,
  setKeepScreenAwake,
} from '../settings/deviceSettings';

const CURRENT_ORIGIN = 'https://api.myorganiser.app';
const PREVIOUS_ORIGIN = 'http://10.0.2.2:3000';

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

function fakeStore(record: BackendOriginRecord) {
  return {
    read: jest.fn<BackendOriginRecord, []>(() => record),
    write: jest.fn<void, [BackendOriginRecord]>(),
  };
}

// Runs the real clear function over the fake effects, as the app wires it.
function runGuard(options: {
  record: BackendOriginRecord;
  effects: ReturnType<typeof fakeEffects>;
  additionalUserIds?: readonly string[];
}) {
  const store = fakeStore(options.record);
  const outcome = guardBackendOrigin({
    currentOrigin: CURRENT_ORIGIN,
    store,
    clearUserLocalData: createClearUserLocalData(options.effects),
    additionalUserIds: options.additionalUserIds,
  });
  return { store, outcome };
}

describe('guardBackendOrigin', () => {
  describe('when the recorded origin matches the current origin', () => {
    it('returns unchanged and neither clears data nor rewrites the record', async () => {
      const effects = fakeEffects();
      const { store, outcome } = runGuard({
        record: { origin: CURRENT_ORIGIN, userIds: ['user-a'] },
        effects,
      });

      await expect(outcome).resolves.toBe('unchanged');
      expect(effects.clearRefreshToken).not.toHaveBeenCalled();
      expect(effects.removeBiometricMasterKey).not.toHaveBeenCalled();
      expect(effects.forgetResumePoint).not.toHaveBeenCalled();
      expect(store.write).not.toHaveBeenCalled();
    });
  });

  describe('when the origin changed since the last launch', () => {
    it('clears the refresh token, the resume point and each owner key, then records the new origin with no owners', async () => {
      const effects = fakeEffects();
      const { store, outcome } = runGuard({
        record: { origin: PREVIOUS_ORIGIN, userIds: ['user-a', 'user-b'] },
        effects,
      });

      await expect(outcome).resolves.toBe('cleared');
      expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(effects.forgetResumePoint).toHaveBeenCalledTimes(1);
      expect(effects.removeBiometricMasterKey.mock.calls).toEqual([
        ['user-a'],
        ['user-b'],
      ]);
      expect(store.write).toHaveBeenCalledTimes(1);
      expect(store.write).toHaveBeenCalledWith({
        origin: CURRENT_ORIGIN,
        userIds: [],
      });
    });

    it('treats a missing record as a change and records the current origin', async () => {
      const effects = fakeEffects();
      const { store, outcome } = runGuard({
        record: { origin: null, userIds: [] },
        effects,
      });

      await expect(outcome).resolves.toBe('cleared');
      expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(effects.removeBiometricMasterKey).not.toHaveBeenCalled();
      expect(store.write).toHaveBeenCalledWith({
        origin: CURRENT_ORIGIN,
        userIds: [],
      });
    });

    it('also clears additional users, removing a user listed twice so their key is removed once', async () => {
      const effects = fakeEffects();
      const { outcome } = runGuard({
        record: { origin: PREVIOUS_ORIGIN, userIds: ['user-a', 'user-b'] },
        effects,
        additionalUserIds: ['user-b', 'user-c'],
      });

      await expect(outcome).resolves.toBe('cleared');
      expect(effects.removeBiometricMasterKey.mock.calls).toEqual([
        ['user-a'],
        ['user-b'],
        ['user-c'],
      ]);
    });

    it('rejects with the failure, still attempts every other item, and leaves the record for the next launch', async () => {
      const effects = fakeEffects();
      const failure = new Error('keystore refused the delete');
      effects.removeBiometricMasterKey.mockImplementation((userId) =>
        userId === 'user-a' ? Promise.reject(failure) : Promise.resolve(),
      );
      const { store, outcome } = runGuard({
        record: { origin: PREVIOUS_ORIGIN, userIds: ['user-a', 'user-b'] },
        effects,
      });

      await expect(outcome).rejects.toBe(failure);
      expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(effects.forgetResumePoint).toHaveBeenCalledTimes(1);
      expect(effects.removeBiometricMasterKey).toHaveBeenCalledWith('user-b');
      expect(store.write).not.toHaveBeenCalled();
    });

    it('writes the record only after the clear has finished', async () => {
      const effects = fakeEffects();
      let releaseRefreshToken: () => void = () => undefined;
      effects.clearRefreshToken.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRefreshToken = resolve;
          }),
      );
      const { store, outcome } = runGuard({
        record: { origin: PREVIOUS_ORIGIN, userIds: ['user-a'] },
        effects,
      });

      // Let every pending microtask and timer run while the clear is held open.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(effects.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(store.write).not.toHaveBeenCalled();

      releaseRefreshToken();
      await expect(outcome).resolves.toBe('cleared');
      expect(store.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('Device Settings', () => {
    it('are not cleared when the origin changes', async () => {
      setAppearance('dark');
      setAutoLockDelay('15m');
      setKeepScreenAwake(false);
      markBiometricUnlockOffered('user-a');

      const effects = fakeEffects();
      const { outcome } = runGuard({
        record: { origin: PREVIOUS_ORIGIN, userIds: ['user-a'] },
        effects,
      });

      await expect(outcome).resolves.toBe('cleared');
      expect(getDeviceSettings()).toEqual({
        appearance: 'dark',
        lastTab: null,
        autoLockDelay: '15m',
        biometricOfferedUserIds: ['user-a'],
        keepScreenAwake: false,
      });
    });
  });
});

describe('isBackendOriginUnchanged', () => {
  it('is true only when the recorded origin equals the current origin exactly', () => {
    expect(
      isBackendOriginUnchanged(
        { origin: CURRENT_ORIGIN, userIds: [] },
        CURRENT_ORIGIN,
      ),
    ).toBe(true);
  });

  it.each<[string | null, string]>([
    [null, 'no origin recorded'],
    [PREVIOUS_ORIGIN, 'a different origin'],
  ])('is false when the record holds %s (%s)', (recordedOrigin) => {
    expect(
      isBackendOriginUnchanged(
        { origin: recordedOrigin, userIds: [] },
        CURRENT_ORIGIN,
      ),
    ).toBe(false);
  });
});

describe('withLocalDataOwner', () => {
  it('adds a new user without mutating the record it was given', () => {
    const record: BackendOriginRecord = {
      origin: CURRENT_ORIGIN,
      userIds: ['user-a'],
    };

    const next = withLocalDataOwner(record, 'user-b');

    expect(next).toEqual({
      origin: CURRENT_ORIGIN,
      userIds: ['user-a', 'user-b'],
    });
    expect(next).not.toBe(record);
    expect(record).toEqual({ origin: CURRENT_ORIGIN, userIds: ['user-a'] });
  });

  it('returns the same record object when the user is already an owner', () => {
    const record: BackendOriginRecord = {
      origin: CURRENT_ORIGIN,
      userIds: ['user-a'],
    };

    expect(withLocalDataOwner(record, 'user-a')).toBe(record);
  });
});
