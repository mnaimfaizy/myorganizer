// The app's version and build, read from the native bundle through the
// local `RNAppInfo` module (apps/mobile ios/RNAppInfo, android … /appinfo).
import { NativeModules } from 'react-native';
import type { AppVersion } from './appVersionShape';

export type { AppVersion };

interface RNAppInfoConstants {
  version?: unknown;
  build?: unknown;
}

/**
 * The installed app's version, or `null` in a build without the module — the
 * About row is left out then rather than showing a number nobody shipped.
 */
export function readAppVersion(): AppVersion | null {
  const constants = (NativeModules as { RNAppInfo?: RNAppInfoConstants })
    .RNAppInfo;
  const version = constants?.version;
  const build = constants?.build;
  if (typeof version !== 'string' || version.length === 0) return null;
  return {
    version,
    build: typeof build === 'string' ? build : String(build ?? ''),
  };
}
