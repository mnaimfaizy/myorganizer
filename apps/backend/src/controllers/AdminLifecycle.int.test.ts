import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { ValidateError } from 'tsoa';
import {
  LastPlatformAdminError,
  UserNotFoundError,
  VerificationCooldownError,
} from '../errors/AdminLifecycleErrors';

jest.setTimeout(30_000);

jest.mock('../helpers/PlatformTokenHandler', () => ({
  __esModule: true,
  PlatformTokenHandler: {
    buildLoginResponse: jest.fn(),
  },
  default: {
    buildLoginResponse: jest.fn(),
  },
}));

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: {
    authenticate: () => (_req: any, _res: any, next: any) => next(),
  },
}));

jest.mock('../middleware/authentication', () => {
  return {
    expressAuthentication: async (
      req: any,
      _securityName: string,
      scopes?: string[],
    ) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        const err = new Error('Unauthorized') as Error & { status?: number };
        err.status = 401;
        throw err;
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : authHeader;

      if (token === 'disabled') {
        const err = new Error('Account disabled') as Error & {
          status?: number;
        };
        err.status = 401;
        throw err;
      }

      if (token === 'user') {
        if (scopes?.includes('platform_admin')) {
          const err = new Error('Platform Admin role required') as Error & {
            status?: number;
          };
          err.status = 403;
          throw err;
        }
        req.user = { id: 'user-1', role: 'user', disabled: false };
        return req.user;
      }

      if (token === 'admin') {
        req.user = { id: 'admin-1', role: 'platform_admin', disabled: false };
        return req.user;
      }

      const err = new Error('Unauthorized') as Error & { status?: number };
      err.status = 401;
      throw err;
    },
  };
});

jest.mock('../services/UserService', () => ({
  __esModule: true,
  default: {
    listIdentityUsers: jest.fn(),
    getIdentityById: jest.fn(),
    disableUser: jest.fn(),
    enableUser: jest.fn(),
    forceLogoutUser: jest.fn(),
    adminResendVerification: jest.fn(),
    promoteUser: jest.fn(),
    demoteUser: jest.fn(),
    listAdminAuditLogs: jest.fn(),
  },
}));

jest.mock('../services/VaultService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/VaultBackupService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/YouTubeNotificationService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/YouTubeSyncService', () => ({
  __esModule: true,
  default: {},
}));

function makeApp() {
  jest.resetModules();

  const { RegisterRoutes } = require('../routes/routes');

  const app = express();
  app.use(bodyParser.json({ limit: '2mb' }));
  RegisterRoutes(app);

  app.use(function tsoaErrorHandler(
    err: unknown,
    _req: any,
    res: any,
    next: any,
  ) {
    if (err instanceof ValidateError) {
      return res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      });
    }

    const anyErr = err as any;
    if (
      anyErr &&
      typeof anyErr === 'object' &&
      typeof anyErr.status === 'number'
    ) {
      return res.status(anyErr.status).json({ message: anyErr.message });
    }

    if (err instanceof Error) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    return next(err);
  });

  return app;
}

const identityRow = {
  id: 'u1',
  name: 'Alice Example',
  first_name: 'Alice',
  last_name: 'Example',
  phone: null,
  email: 'alice@example.com',
  role: 'user',
  disabled: false,
  email_verification_timestamp: new Date('2024-01-01'),
  password: 'secret-hash',
  blacklisted_tokens: ['old-token'],
  reset_password_token: 'reset-token',
  email_verification_token: 'verify-token',
  youtube_access_token: 'yt-token',
  encrypted_vault: 'vault-ciphertext',
};

const expectedIdentityDto = {
  id: 'u1',
  name: 'Alice Example',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Example',
  role: 'user',
  disabled: false,
  emailVerified: true,
};

const auditLogRow = {
  id: 'log-1',
  actor_user_id: 'admin-1',
  target_user_id: 'u1',
  action: 'disable' as const,
  created_at: new Date('2024-06-01T12:00:00.000Z'),
};

describe('Admin lifecycle mutations and audit logs (HTTP integration)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = makeApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/users/:userId/disable', () => {
    test('returns 401 when unauthenticated', async () => {
      const userService = require('../services/UserService').default;

      const res = await request(app).post('/admin/users/u1/disable');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Unauthorized' });
      expect(userService.disableUser).not.toHaveBeenCalled();
    });

    test('returns 403 for authenticated non-platform_admin', async () => {
      const userService = require('../services/UserService').default;

      const res = await request(app)
        .post('/admin/users/u1/disable')
        .set('Authorization', 'Bearer user');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Platform Admin role required' });
      expect(userService.disableUser).not.toHaveBeenCalled();
    });

    test('returns 200 with identity DTO for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.disableUser.mockResolvedValueOnce(identityRow);

      const res = await request(app)
        .post('/admin/users/u1/disable')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.disableUser).toHaveBeenCalledWith('admin-1', 'u1');
      expect(res.body).toEqual(expectedIdentityDto);
    });

    test('returns 404 when user not found', async () => {
      const userService = require('../services/UserService').default;

      userService.disableUser.mockRejectedValueOnce(new UserNotFoundError());

      const res = await request(app)
        .post('/admin/users/u1/disable')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
      expect(userService.disableUser).toHaveBeenCalledWith('admin-1', 'u1');
    });
  });

  describe('POST /admin/users/:userId/enable', () => {
    test('returns 200 and calls enableUser for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.enableUser.mockResolvedValueOnce(identityRow);

      const res = await request(app)
        .post('/admin/users/u1/enable')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.enableUser).toHaveBeenCalledWith('admin-1', 'u1');
      expect(res.body).toEqual(expectedIdentityDto);
    });
  });

  describe('POST /admin/users/:userId/force-logout', () => {
    test('returns 200 and calls forceLogoutUser for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.forceLogoutUser.mockResolvedValueOnce(identityRow);

      const res = await request(app)
        .post('/admin/users/u1/force-logout')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.forceLogoutUser).toHaveBeenCalledWith('admin-1', 'u1');
      expect(res.body).toEqual(expectedIdentityDto);
    });
  });

  describe('POST /admin/users/:userId/promote', () => {
    test('returns 200 and calls promoteUser for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.promoteUser.mockResolvedValueOnce({
        ...identityRow,
        role: 'platform_admin',
      });

      const res = await request(app)
        .post('/admin/users/u1/promote')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.promoteUser).toHaveBeenCalledWith('admin-1', 'u1');
      expect(res.body).toEqual({
        ...expectedIdentityDto,
        role: 'platform_admin',
      });
    });
  });

  describe('POST /admin/users/:userId/demote', () => {
    test('returns 409 when demoting the last Platform Admin', async () => {
      const userService = require('../services/UserService').default;

      userService.demoteUser.mockRejectedValueOnce(
        new LastPlatformAdminError(),
      );

      const res = await request(app)
        .post('/admin/users/admin-1/demote')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        message: 'Cannot demote the last Platform Admin',
      });
      expect(userService.demoteUser).toHaveBeenCalledWith('admin-1', 'admin-1');
    });

    test('returns 200 and calls demoteUser for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.demoteUser.mockResolvedValueOnce(identityRow);

      const res = await request(app)
        .post('/admin/users/u1/demote')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.demoteUser).toHaveBeenCalledWith('admin-1', 'u1');
      expect(res.body).toEqual(expectedIdentityDto);
    });
  });

  describe('POST /admin/users/:userId/resend-verification', () => {
    test('returns 429 when verification cooldown is active', async () => {
      const userService = require('../services/UserService').default;

      userService.adminResendVerification.mockRejectedValueOnce(
        new VerificationCooldownError(),
      );

      const res = await request(app)
        .post('/admin/users/u1/resend-verification')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        message:
          'A verification email was already sent recently. Please try again later.',
      });
      expect(userService.adminResendVerification).toHaveBeenCalledWith(
        'admin-1',
        'u1',
      );
    });

    test('returns 200 with success message', async () => {
      const userService = require('../services/UserService').default;

      userService.adminResendVerification.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/admin/users/u1/resend-verification')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'Verification email sent successfully',
      });
      expect(userService.adminResendVerification).toHaveBeenCalledWith(
        'admin-1',
        'u1',
      );
    });
  });

  describe('GET /admin/audit-logs', () => {
    test('returns 401 when unauthenticated', async () => {
      const userService = require('../services/UserService').default;

      const res = await request(app).get('/admin/audit-logs');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Unauthorized' });
      expect(userService.listAdminAuditLogs).not.toHaveBeenCalled();
    });

    test('returns 403 for authenticated non-platform_admin', async () => {
      const userService = require('../services/UserService').default;

      const res = await request(app)
        .get('/admin/audit-logs')
        .set('Authorization', 'Bearer user');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Platform Admin role required' });
      expect(userService.listAdminAuditLogs).not.toHaveBeenCalled();
    });

    test('returns 200 with mapped audit log entries for platform_admin', async () => {
      const userService = require('../services/UserService').default;

      userService.listAdminAuditLogs.mockResolvedValueOnce([auditLogRow]);

      const res = await request(app)
        .get('/admin/audit-logs')
        .set('Authorization', 'Bearer admin');

      expect(res.status).toBe(200);
      expect(userService.listAdminAuditLogs).toHaveBeenCalledWith(undefined);
      expect(res.body).toEqual([
        {
          id: 'log-1',
          actorUserId: 'admin-1',
          targetUserId: 'u1',
          action: 'disable',
          createdAt: '2024-06-01T12:00:00.000Z',
        },
      ]);
    });
  });
});
