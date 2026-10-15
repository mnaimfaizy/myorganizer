import { clearRefreshToken } from '@myorganiser/mobile/feat-auth';
import {
  disableBiometricUnlock,
  nativeBiometricKeystore,
} from '@myorganiser/mobile/feat-vault';
import {
  createClearUserLocalData,
  forgetResumePoint,
} from '@myorganiser/mobile/core';

/**
 * Clears a User's local data on this device, leaving Device Settings alone.
 * Logout and the backend origin guard both call it; see clearUserLocalData.ts
 * in @myorganiser/mobile/core for what it covers.
 *
 * Wired here because this is the only place that can see the auth keychain
 * and the vault keystore together.
 */
export const clearUserLocalData = createClearUserLocalData({
  clearRefreshToken,
  removeBiometricMasterKey: (userId) =>
    disableBiometricUnlock(nativeBiometricKeystore, userId),
  forgetResumePoint,
});
