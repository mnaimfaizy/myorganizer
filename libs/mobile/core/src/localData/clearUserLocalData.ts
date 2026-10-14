// The one "clear this User's local data" function.
//
// Everything a User leaves on this device that belongs to them rather than to
// the installation: the Refresh Token, the Biometric Unlock Master Key item
// (ADR 0108 decision 3), and the resume point. Logout, a backend origin change
// (backendOriginGuard.ts), and User Deletion all end here, so none of them can
// forget an item the others remember.
//
// Device Settings are not here on purpose. They belong to the installation
// (deviceSettings.ts), so no path through this function can reach them.
//
// The effects are supplied by the app shell because they live in libraries
// this one must not depend on (the auth keychain, the vault keystore).

export interface UserLocalDataEffects {
  /** Drop the stored Refresh Token. Device-wide: there is one at most. */
  clearRefreshToken: () => Promise<void>;
  /** Delete this User's Biometric Unlock Master Key item, if there is one. */
  removeBiometricMasterKey: (userId: string) => Promise<void>;
  /** Forget where the User was reading. */
  forgetResumePoint: () => void;
}

export type ClearUserLocalData = (userIds: readonly string[]) => Promise<void>;

/**
 * Runs an effect as a promise, so one that throws synchronously is a rejection
 * like any other rather than an exception that skips the effects after it.
 */
function attempt(effect: () => void | Promise<void>): Promise<void> {
  return Promise.resolve().then(effect);
}

/**
 * Builds the clear function over the given effects.
 *
 * Every item is attempted even when an earlier one fails, however it fails, so
 * one keystore that refused a delete cannot leave the rest behind. The first
 * failure, in the order resume point, Refresh Token, then each User's key, is
 * then rethrown, so a caller that must not carry on over leftover data can
 * tell.
 */
export function createClearUserLocalData(
  effects: UserLocalDataEffects,
): ClearUserLocalData {
  return async (userIds) => {
    const results = await Promise.allSettled([
      attempt(effects.forgetResumePoint),
      attempt(effects.clearRefreshToken),
      ...[...new Set(userIds)].map((userId) =>
        attempt(() => effects.removeBiometricMasterKey(userId)),
      ),
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) throw failure.reason;
  };
}
