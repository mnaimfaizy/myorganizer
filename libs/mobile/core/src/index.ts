// @myorganizer/mobile/core — device-scoped state shared across mobile features.
export {
  DEFAULT_APPEARANCE,
  toAppearance,
  type Appearance,
} from './settings/appearance';
export {
  getDeviceSettings,
  setAppearance,
  setLastTab,
  subscribeToDeviceSettings,
} from './settings/deviceSettings';
export type { DeviceSettings } from './settings/deviceSettings';
export { useAppearance } from './settings/useAppearance';
