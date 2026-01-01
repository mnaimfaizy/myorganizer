import fs from 'fs';
import path from 'path';

import sendEmail from './EmailService';
import userService from './UserService';

jest.mock('./EmailService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../helpers/ApiTokens', () => ({
  __esModule: true,
  default: {
    generateEmailVerificationToken: jest.fn(() => 'test-token'),
  },
}));

describe('UserService email template paths', () => {
  let existsSyncSpy: jest.SpyInstance;
  let readFileSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    existsSyncSpy = jest.spyOn(fs, 'existsSync');
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync');

    process.env.APP_FRONTEND_URL = 'http://localhost:3000';
    process.env.APP_NAME = 'MyOrganizer';

    readFileSyncSpy.mockReturnValue(
      '<a href="[Verification Link]">Verify</a> - [Your Company]'
    );
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  test('prefers dist-style __dirname/templates path when present', async () => {
    const userServicePath = require.resolve('./UserService');
    const serviceDir = path.dirname(userServicePath);

    const distTemplatePath = path.join(
      serviceDir,
      'templates',
      'verify-email.html'
    );
    const fallbackTemplatePath = path.join(
      serviceDir,
      '..',
      'templates',
      'verify-email.html'
    );

    existsSyncSpy.mockImplementation((p: any) => p === distTemplatePath);

    await userService.sendVerificationMail({
      id: 'user-1',
      email: 'test@example.com',
    } as any);

    expect(existsSyncSpy).toHaveBeenCalledWith(distTemplatePath);
    expect(readFileSyncSpy).toHaveBeenCalledWith(distTemplatePath, 'utf8');
    expect(readFileSyncSpy).not.toHaveBeenCalledWith(
      fallbackTemplatePath,
      'utf8'
    );

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      'test@example.com',
      'Verify your email',
      expect.stringContaining(
        'http://localhost:3000/verify/email?token=test-token'
      )
    );
  });

  test('falls back to __dirname/../templates path in dev/test', async () => {
    const userServicePath = require.resolve('./UserService');
    const serviceDir = path.dirname(userServicePath);

    const distTemplatePath = path.join(
      serviceDir,
      'templates',
      'verify-email.html'
    );
    const fallbackTemplatePath = path.join(
      serviceDir,
      '..',
      'templates',
      'verify-email.html'
    );

    existsSyncSpy.mockImplementation((p: any) => p === fallbackTemplatePath);

    await userService.sendVerificationMail({
      id: 'user-1',
      email: 'test@example.com',
    } as any);

    expect(existsSyncSpy).toHaveBeenCalledWith(distTemplatePath);
    expect(existsSyncSpy).toHaveBeenCalledWith(fallbackTemplatePath);
    expect(readFileSyncSpy).toHaveBeenCalledWith(fallbackTemplatePath, 'utf8');

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
