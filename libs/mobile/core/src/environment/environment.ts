// Where the Mobile App talks to: the one place that decides it.
//
// Pure on purpose. The build type and the platform arrive as arguments, so the
// decision runs under the node Jest environment (ADR 0103) and the adapter
// beside this file (mobileEnvironment.ts) is the only code that reads the
// React Native globals.

/**
 * The backend a build talks to. `local` is the operator's development
 * machine; `production` is the real service. There is no Staging target
 * (PRD #956).
 */
export type BackendTarget = 'local' | 'production';

export interface MobileEnvironment {
  target: BackendTarget;
  /** Scheme, host and port of the API, with no path. */
  apiOrigin: string;
  /** The versioned API root every generated client is built on. */
  apiBasePath: string;
  /** Scheme, host and port of the web app, with no path. */
  webAppOrigin: string;
}

/**
 * Production origins. Product Surface (ADR 0086): public by nature, so they
 * may be committed. The deployment docs carry the same values
 * (docs/deployment/CPANEL_BACKEND_HOSTING.md, CPANEL_WEB_HOSTING.md).
 */
export const PRODUCTION_API_ORIGIN = 'https://api.myorganiser.app';
export const PRODUCTION_WEB_APP_ORIGIN = 'https://myorganiser.app';

/**
 * Where a User downloads the current Mobile Release: the Production web app's
 * download page (built in #1115), in every build. Update required links here,
 * and a debug build's local web app has no release to offer.
 */
export const MOBILE_RELEASE_DOWNLOAD_URL = `${PRODUCTION_WEB_APP_ORIGIN}/download`;

const API_VERSION_PATH = '/api/v1';
const LOCAL_API_PORT = 3000;
const LOCAL_WEB_APP_PORT = 4200;

export interface EnvironmentInputs {
  /** `__DEV__`: true in a debug bundle, false in a release bundle. */
  isDevBuild: boolean;
  /** The bundle-time switch, fixed when Metro starts (see bundleTarget.ts). */
  bundleTarget: BackendTarget;
  /** `Platform.OS`. */
  platform: string;
}

/**
 * A release build talks to Production and nothing else: the bundle-time
 * switch is read only by a debug build, so no release bundle can carry a
 * route to the local host.
 */
export function resolveBackendTarget(
  inputs: Pick<EnvironmentInputs, 'isDevBuild' | 'bundleTarget'>,
): BackendTarget {
  if (!inputs.isDevBuild) return 'production';
  return inputs.bundleTarget;
}

/**
 * The development machine as the device sees it. An Android emulator reaches
 * its host at 10.0.2.2; an iOS simulator resolves localhost directly.
 */
export function localDevelopmentHost(platform: string): string {
  return platform === 'android' ? '10.0.2.2' : 'localhost';
}

export function resolveEnvironment(
  inputs: EnvironmentInputs,
): MobileEnvironment {
  const target = resolveBackendTarget(inputs);
  if (target === 'production') {
    return {
      target,
      apiOrigin: PRODUCTION_API_ORIGIN,
      apiBasePath: `${PRODUCTION_API_ORIGIN}${API_VERSION_PATH}`,
      webAppOrigin: PRODUCTION_WEB_APP_ORIGIN,
    };
  }
  const host = localDevelopmentHost(inputs.platform);
  const apiOrigin = `http://${host}:${LOCAL_API_PORT}`;
  return {
    target,
    apiOrigin,
    apiBasePath: `${apiOrigin}${API_VERSION_PATH}`,
    webAppOrigin: `http://${host}:${LOCAL_WEB_APP_PORT}`,
  };
}
