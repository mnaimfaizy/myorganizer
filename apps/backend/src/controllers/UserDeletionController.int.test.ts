import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { EMAIL_BRAND_NAME } from '@myorganiser/email-shell';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

jest.setTimeout(30_000);

jest.mock('../helpers/PlatformTokenHandler', () => ({
  __esModule: true,
  PlatformTokenHandler: {
    issueLoginSession: jest.fn(),
  },
  default: {
    issueLoginSession: jest.fn(),
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
    expressAuthentication: async (req: any) => {
      const authHeader = req?.headers?.authorization;
      if (authHeader === 'Bearer user') {
        req.user = { id: 'user-1', role: 'user', disabled: false };
        return req.user;
      }

      const err = new Error('Unauthorized') as Error & { status?: number };
      err.status = 401;
      throw err;
    },
  };
});

// The Google boundary for this file. The revoke call itself is covered by
// YouTubeSyncService.spec.ts; here disconnect is the only seam.
jest.mock('../services/YouTubeSyncService', () => ({
  __esModule: true,
  default: {
    disconnect: jest.fn(),
  },
}));

jest.mock('../services/EmailService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../prisma', () => {
  const __mockPrisma = {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return {
    __esModule: true,
    __mockPrisma,
    createPrismaClient: jest.fn(() => __mockPrisma),
    PrismaClient: jest.fn(),
  };
});

jest.mock('../services/VaultService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/VaultBackupService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/YouTubeSyncWorkerService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/YouTubeDigestService', () => ({
  __esModule: true,
  default: {},
}));

type AnyMock = jest.Mock<(...args: any[]) => any>;

type MockPrisma = {
  user: { findUnique: AnyMock; delete: AnyMock };
  $transaction: AnyMock;
};

const CORRECT_PASSWORD = 'correct-pass1';
const WRONG_PASSWORD = 'wrong-pass-12';
const REFRESH_COOKIE_HEADER = 'refresh_cookie=rt-value';

// Real bcrypt hash so UserService's bcrypt.compare runs for real.
const PASSWORD_HASH = bcrypt.hashSync(CORRECT_PASSWORD, 4);

const DELETED_EMAIL = 'deleted@example.com';

function makeUser() {
  return {
    id: 'user-1',
    email: DELETED_EMAIL,
    name: 'Dana Test',
    first_name: 'Dana',
    last_name: 'Test',
    password: PASSWORD_HASH,
  };
}

function makeApp() {
  jest.resetModules();

  const { RegisterRoutes } = require('../routes/routes');
  // Loaded after resetModules so its tsoa ValidateError class is the same one
  // the routes throw; a top-level import would fail the instanceof check.
  const { attachTsoaErrorHandler } = require('../testing/tsoaErrorHandler');

  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.json({ limit: '2mb' }));
  RegisterRoutes(app);
  attachTsoaErrorHandler(app);
  return app;
}

function refs() {
  const prisma: MockPrisma = require('../prisma').__mockPrisma;
  const youtube: { disconnect: AnyMock } =
    require('../services/YouTubeSyncService').default;
  const sendEmail: AnyMock = require('../services/EmailService').default;
  return { prisma, youtube, sendEmail };
}

function deleteMe(app: express.Application, body: Record<string, unknown>) {
  return request(app)
    .delete('/users/me')
    .set('Authorization', 'Bearer user')
    .send(body);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { password: CORRECT_PASSWORD, confirmation: 'DELETE', ...overrides };
}

function expectNothingDeleted() {
  const { prisma, youtube, sendEmail } = refs();
  expect(youtube.disconnect).not.toHaveBeenCalled();
  expect(prisma.user.delete).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
}

describe('DELETE /users/me (User Deletion HTTP integration)', () => {
  let app: express.Application;

  beforeAll(() => {
    app = makeApp();
  });

  beforeEach(() => {
    jest.resetAllMocks();

    const { prisma, youtube, sendEmail } = refs();
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.delete.mockResolvedValue({ id: 'user-1' });
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    youtube.disconnect.mockResolvedValue({
      ok: true,
      message: 'YouTube account disconnected.',
    });
    sendEmail.mockResolvedValue(undefined);
  });

  test('returns 204 with an empty body and disconnects YouTube with only the user id', async () => {
    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const { youtube } = refs();
    expect(youtube.disconnect).toHaveBeenCalledTimes(1);
    expect(youtube.disconnect.mock.calls[0]).toStrictEqual(['user-1']);
  });

  test('deletes the User row and sends one confirmation email to the deleted address', async () => {
    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    const { prisma, sendEmail } = refs();
    expect(prisma.user.delete).toHaveBeenCalledTimes(1);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      DELETED_EMAIL,
      expect.stringContaining(EMAIL_BRAND_NAME),
      expect.objectContaining({
        text: expect.stringContaining('Hi Dana Test'),
      }),
    );
  });

  test('clears the refresh cookie with the attributes it was set with', async () => {
    const res = await deleteMe(app, validBody()).set(
      'Cookie',
      REFRESH_COOKIE_HEADER,
    );

    expect(res.status).toBe(204);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookie.find((cookie) =>
      cookie.startsWith('refresh_cookie=;'),
    );
    expect(cleared).toBeDefined();
    expect(cleared).toContain('Path=/');
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toMatch(/SameSite=Lax/i);
  });

  test('refuses a wrong password with 403 and deletes nothing', async () => {
    const res = await deleteMe(app, validBody({ password: WRONG_PASSWORD }));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Incorrect password.' });
    expectNothingDeleted();
  });

  test.each([
    ['password is missing', { confirmation: 'DELETE' }],
    ['password is empty', validBody({ password: '' })],
    ['confirmation is lowercase', validBody({ confirmation: 'delete' })],
    ['confirmation is missing', { password: CORRECT_PASSWORD }],
    ['an extra key is present', validBody({ extra: true })],
  ])(
    'returns 422 Validation Failed and deletes nothing when %s',
    async (_label, body) => {
      const res = await deleteMe(app, body);

      expect(res.status).toBe(422);
      expect(res.body.message).toBe('Validation Failed');
      expectNothingDeleted();
    },
  );

  test('returns 401 and deletes nothing when unauthenticated', async () => {
    const res = await request(app).delete('/users/me').send(validBody());

    expect(res.status).toBe(401);
    expectNothingDeleted();
  });

  test('returns 409 and keeps the User when a YouTube sync is live', async () => {
    const { youtube } = refs();
    youtube.disconnect.mockResolvedValue({
      ok: false,
      code: 'sync_run_live',
      message: 'A YouTube sync is running.',
    });

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message:
        'A YouTube sync is running. Try deleting your account again shortly.',
    });
    const { prisma, sendEmail } = refs();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('still deletes the User when they never connected YouTube', async () => {
    const { youtube } = refs();
    youtube.disconnect.mockResolvedValue({
      ok: false,
      message: 'No YouTube integration found.',
    });

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    const { prisma } = refs();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  test('still deletes the User when Google revocation fails locally', async () => {
    const { youtube } = refs();
    youtube.disconnect.mockResolvedValue({
      ok: true,
      revokeFailed: true,
      message: 'YouTube account disconnected locally.',
      googlePermissionsUrl: 'https://myaccount.google.com/permissions',
    });

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    const { prisma } = refs();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  test('disconnects YouTube before the User row is deleted', async () => {
    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    const { prisma, youtube } = refs();
    const disconnectOrder = youtube.disconnect.mock.invocationCallOrder[0];
    const deleteOrder = prisma.user.delete.mock.invocationCallOrder[0];
    expect(disconnectOrder).toBeLessThan(deleteOrder);
  });

  test('still returns 204 and deletes the User when the confirmation email fails', async () => {
    const { sendEmail } = refs();
    sendEmail.mockRejectedValue(new Error('smtp unavailable'));

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(204);
    const { prisma } = refs();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  test('returns 500 and deletes nothing when the YouTube disconnect throws', async () => {
    const { youtube } = refs();
    youtube.disconnect.mockRejectedValue(new Error('database connection lost'));

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('database connection lost');
    const { prisma, sendEmail } = refs();
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('returns 404 and deletes nothing when the User vanished before deletion', async () => {
    const { prisma } = refs();
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await deleteMe(app, validBody());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'User not found' });
    expectNothingDeleted();
  });
});
