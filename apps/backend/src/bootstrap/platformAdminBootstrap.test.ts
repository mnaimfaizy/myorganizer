import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

jest.mock('../services/UserService', () => ({
  __esModule: true,
  default: {
    elevateToPlatformAdminByEmail: jest.fn(),
  },
}));

const userService = require('../services/UserService').default as {
  elevateToPlatformAdminByEmail: jest.MockedFunction<
    (
      email: string,
    ) => Promise<{ id: string; email: string; role: string } | null>
  >;
};
const { bootstrapPlatformAdminFromEnv } =
  require('./platformAdminBootstrap') as {
    bootstrapPlatformAdminFromEnv: () => Promise<void>;
  };

const elevateMock = userService.elevateToPlatformAdminByEmail;

describe('bootstrapPlatformAdminFromEnv', () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;
  let logSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('no-ops when PLATFORM_ADMIN_BOOTSTRAP_EMAIL is unset', async () => {
    await bootstrapPlatformAdminFromEnv();

    expect(elevateMock).not.toHaveBeenCalled();
  });

  test('no-ops when PLATFORM_ADMIN_BOOTSTRAP_EMAIL is empty or whitespace', async () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL = '   ';

    await bootstrapPlatformAdminFromEnv();

    expect(elevateMock).not.toHaveBeenCalled();
  });

  test('calls elevateToPlatformAdminByEmail with trimmed email when set', async () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL = '  admin@example.com  ';
    elevateMock.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'platform_admin',
    });

    await bootstrapPlatformAdminFromEnv();

    expect(elevateMock).toHaveBeenCalledWith('admin@example.com');
  });

  test('warns and does not throw when elevate returns null', async () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL = 'missing@example.com';
    elevateMock.mockResolvedValueOnce(null);

    await expect(bootstrapPlatformAdminFromEnv()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      '[bootstrap] PLATFORM_ADMIN_BOOTSTRAP_EMAIL=missing@example.com did not match any User; skipping elevation.',
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('logs success when elevated user is returned', async () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL = 'admin@example.com';
    elevateMock.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'platform_admin',
    });

    await bootstrapPlatformAdminFromEnv();

    expect(logSpy).toHaveBeenCalledWith(
      '[bootstrap] Platform Admin ready for admin@example.com (role=platform_admin).',
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
