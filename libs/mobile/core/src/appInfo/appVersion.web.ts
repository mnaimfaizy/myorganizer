// Web variant of ./appVersion, selected by the Vite `resolve.extensions` list
// in apps/mobile/vite.config.mts ('.web.ts' precedes '.ts'). The
// react-native-web preview has no native bundle to read a version from, so
// the About row is left out there.
import type { AppVersion } from './appVersionShape';

export type { AppVersion };

export function readAppVersion(): AppVersion | null {
  return null;
}
