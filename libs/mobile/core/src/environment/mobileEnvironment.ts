// The environment this bundle runs in, resolved once at import.
//
// Synchronous and import-time because the API client builds its Axios
// instance when its module loads, before any component renders.
import { Platform } from 'react-native';
import { BUNDLE_TARGET } from './bundleTarget';
import { resolveEnvironment, type MobileEnvironment } from './environment';

export const MOBILE_ENVIRONMENT: MobileEnvironment = resolveEnvironment({
  isDevBuild: __DEV__,
  bundleTarget: BUNDLE_TARGET,
  platform: Platform.OS,
});
