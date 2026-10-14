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
  setKeepScreenAwake,
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
  useKeepAwake,
  useKeepScreenAwakeSetting,
} from './keepAwake/useKeepAwake';
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
export { readAppVersion, type AppVersion } from './appInfo/appVersion';
export {
  PRODUCTION_API_ORIGIN,
  PRODUCTION_WEB_APP_ORIGIN,
  localDevelopmentHost,
  resolveBackendTarget,
  resolveEnvironment,
  type BackendTarget,
  type EnvironmentInputs,
  type MobileEnvironment,
} from './environment/environment';
export { MOBILE_ENVIRONMENT } from './environment/mobileEnvironment';
export {
  createClearUserLocalData,
  type ClearUserLocalData,
  type UserLocalDataEffects,
} from './localData/clearUserLocalData';
export {
  guardBackendOrigin,
  isBackendOriginUnchanged,
  withLocalDataOwner,
  type BackendOriginGuardOutcome,
  type BackendOriginRecord,
  type BackendOriginStore,
} from './localData/backendOriginGuard';
export { backendOriginStore } from './localData/backendOriginStorage';
export { rememberLocalDataOwner } from './localData/localDataOwner';
