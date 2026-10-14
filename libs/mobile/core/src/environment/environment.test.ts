import {
  localDevelopmentHost,
  PRODUCTION_API_ORIGIN,
  PRODUCTION_WEB_APP_ORIGIN,
  resolveBackendTarget,
  resolveEnvironment,
  type BackendTarget,
} from './environment';

const BUNDLE_TARGETS: BackendTarget[] = ['local', 'production'];
const PLATFORMS = ['android', 'ios'];

describe('resolveBackendTarget', () => {
  describe('release build', () => {
    it.each(BUNDLE_TARGETS)(
      'resolves to production when the bundle-time switch is %s',
      (bundleTarget) => {
        expect(resolveBackendTarget({ isDevBuild: false, bundleTarget })).toBe(
          'production',
        );
      },
    );
  });

  describe('debug build', () => {
    it.each(BUNDLE_TARGETS)(
      'follows the bundle-time switch when it is %s',
      (bundleTarget) => {
        expect(resolveBackendTarget({ isDevBuild: true, bundleTarget })).toBe(
          bundleTarget,
        );
      },
    );
  });
});

describe('resolveEnvironment', () => {
  describe('debug build pointed at the local host', () => {
    it('resolves Android to the emulator host 10.0.2.2', () => {
      expect(
        resolveEnvironment({
          isDevBuild: true,
          bundleTarget: 'local',
          platform: 'android',
        }),
      ).toEqual({
        target: 'local',
        apiOrigin: 'http://10.0.2.2:3000',
        apiBasePath: 'http://10.0.2.2:3000/api/v1',
        webAppOrigin: 'http://10.0.2.2:4200',
      });
    });

    it('resolves iOS to localhost', () => {
      expect(
        resolveEnvironment({
          isDevBuild: true,
          bundleTarget: 'local',
          platform: 'ios',
        }),
      ).toEqual({
        target: 'local',
        apiOrigin: 'http://localhost:3000',
        apiBasePath: 'http://localhost:3000/api/v1',
        webAppOrigin: 'http://localhost:4200',
      });
    });
  });

  describe('bundle-time switch flipping a debug build', () => {
    it.each(PLATFORMS)(
      'points a debug %s build at Production when the switch is production',
      (platform) => {
        expect(
          resolveEnvironment({
            isDevBuild: true,
            bundleTarget: 'production',
            platform,
          }),
        ).toEqual({
          target: 'production',
          apiOrigin: PRODUCTION_API_ORIGIN,
          apiBasePath: `${PRODUCTION_API_ORIGIN}/api/v1`,
          webAppOrigin: PRODUCTION_WEB_APP_ORIGIN,
        });
      },
    );
  });

  describe('release build', () => {
    const cases = PLATFORMS.flatMap((platform) =>
      BUNDLE_TARGETS.map((bundleTarget) => ({ platform, bundleTarget })),
    );

    it.each(cases)(
      'resolves only to Production over HTTPS on $platform with switch $bundleTarget',
      ({ platform, bundleTarget }) => {
        const environment = resolveEnvironment({
          isDevBuild: false,
          bundleTarget,
          platform,
        });

        expect(environment).toEqual({
          target: 'production',
          apiOrigin: 'https://api.myorganiser.app',
          apiBasePath: 'https://api.myorganiser.app/api/v1',
          webAppOrigin: 'https://myorganiser.app',
        });
        expect(environment.apiOrigin).toBe(PRODUCTION_API_ORIGIN);
        expect(environment.webAppOrigin).toBe(PRODUCTION_WEB_APP_ORIGIN);
        for (const origin of [
          environment.apiOrigin,
          environment.apiBasePath,
          environment.webAppOrigin,
        ]) {
          expect(origin.startsWith('https://')).toBe(true);
        }
      },
    );
  });
});

describe('localDevelopmentHost', () => {
  it('returns the Android emulator host alias for android', () => {
    expect(localDevelopmentHost('android')).toBe('10.0.2.2');
  });

  it.each(['ios', 'web'])('returns localhost for %s', (platform) => {
    expect(localDevelopmentHost(platform)).toBe('localhost');
  });
});
