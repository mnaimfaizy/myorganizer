// Web variant of ./mobileEnvironment, selected by the Vite `resolve.extensions`
// list in apps/mobile/vite.config.mts and by `moduleSuffixes` in
// apps/mobile/tsconfig.web.json.
//
// The web target is the react-native-web preview of this app, which never
// ships, and Vite defines no `__DEV__`. It is a development build by
// definition. Only Metro swaps bundleTarget.ts, so the preview always talks to
// the development machine.
import { Platform } from 'react-native';
import { BUNDLE_TARGET } from './bundleTarget';
import { resolveEnvironment, type MobileEnvironment } from './environment';

export const MOBILE_ENVIRONMENT: MobileEnvironment = resolveEnvironment({
  isDevBuild: true,
  bundleTarget: BUNDLE_TARGET,
  platform: Platform.OS,
});
