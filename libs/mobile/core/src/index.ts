// @myorganizer/mobile/core — device-scoped state shared across mobile features.
export {
  DEFAULT_APPEARANCE,
  toAppearance,
  type Appearance,
} from './settings/appearance';
export {
  getDeviceSettings,
  hasOfferedBiometricUnlock,
  markBiometricUnlockOffered,
  setAppearance,
  setAutoLockDelay,
  setLastTab,
  subscribeToDeviceSettings,
} from './settings/deviceSettings';
export type { DeviceSettings } from './settings/deviceSettings';
export {
  serializeOfferedUserIds,
  toOfferedUserIds,
  withOfferedUserId,
} from './settings/biometricOffer';
export { useAppearance } from './settings/useAppearance';
export { useAutoLockDelay } from './settings/useAutoLockDelay';
export {
  autoLockDelayMs,
  DEFAULT_AUTO_LOCK_DELAY,
  describeAutoLock,
  toAutoLockDelay,
  type AutoLockDelay,
  type AutoLockDelayMeta,
} from './lock/autoLockDelay';
export { shouldAutoLock, type AutoLockInput } from './lock/autoLockDecision';
export {
  forgetResumePoint,
  recallScrollOffset,
  rememberScrollOffset,
} from './lock/resumePoint';
