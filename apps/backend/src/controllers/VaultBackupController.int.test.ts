import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { ValidateError } from 'tsoa';

jest.setTimeout(120_000);

jest.mock('../middleware/authentication', () => {
  return {
    expressAuthentication: async (req: any) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        const err: any = new Error('No token provided');
        err.status = 401;
        throw err;
      }

      const userId = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : 'user-1';
      req.user = { id: userId || 'user-1' };
      return req.user;
    },
  };
});

jest.mock('../services/VaultBackupService', () => {
  const recordEvent = jest.fn();
  const getLatest = jest.fn();
  const listHistory = jest.fn();
  return {
    __esModule: true,
    default: { recordEvent, getLatest, listHistory },
    VaultBackupService: jest.fn(),
    VAULT_BACKUP_BLOB_TYPES: [
      'addresses',
      'mobileNumbers',
      'subscriptions',
      'todos',
    ],
  };
});

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
    if (anyErr && typeof anyErr.status === 'number') {
      return res.status(anyErr.status).json({ message: anyErr.message });
    }
    if (err instanceof Error) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    return next(err);
  });

  return app;
}

describe('VaultBackupController (HTTP integration)', () => {
  const validBody = {
    event: 'export',
    source: 'local-file',
    status: 'success',
    schemaVersion: 1,
    blobTypes: ['addresses', 'todos'],
    sizeBytes: 2048,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires auth for POST /vault/backups', async () => {
    const app = makeApp();
    const res = await request(app).post('/vault/backups').send(validBody);
    expect(res.status).toBe(401);
  });

  test('returns 201 when recording a successful backup', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.recordEvent.mockResolvedValueOnce({
      ok: true,
      status: 201,
      body: {
        id: 'rec-1',
        userId: 'user-1',
        ...validBody,
        errorCode: null,
        createdAt: new Date().toISOString(),
      },
    });

    const res = await request(app)
      .post('/vault/backups')
      .set('Authorization', 'Bearer user-1')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('rec-1');
    expect(svc.recordEvent).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ event: 'export', status: 'success' }),
    );
  });

  test('records failed import with errorCode', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.recordEvent.mockResolvedValueOnce({
      ok: true,
      status: 201,
      body: {
        id: 'rec-2',
        userId: 'user-1',
        event: 'import',
        source: 'local-file',
        status: 'failed',
        errorCode: 'corrupt-file',
        schemaVersion: 1,
        blobTypes: [],
        sizeBytes: 16,
        createdAt: new Date().toISOString(),
      },
    });

    const res = await request(app)
      .post('/vault/backups')
      .set('Authorization', 'Bearer user-1')
      .send({
        event: 'import',
        source: 'local-file',
        status: 'failed',
        errorCode: 'corrupt-file',
        schemaVersion: 1,
        blobTypes: [],
        sizeBytes: 16,
      });

    expect(res.status).toBe(201);
    expect(res.body.errorCode).toBe('corrupt-file');
  });

  test('returns 400 for invalid source (TSOA enum validation)', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;

    const res = await request(app)
      .post('/vault/backups')
      .set('Authorization', 'Bearer user-1')
      .send({ ...validBody, source: 'cloud-magic' });

    expect(res.status).toBe(400);
    expect(svc.recordEvent).not.toHaveBeenCalled();
  });

  test('returns 404 when no latest backup exists', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.getLatest.mockResolvedValueOnce({
      ok: false,
      status: 404,
      body: { message: 'No backup records' },
    });

    const res = await request(app)
      .get('/vault/backups/latest')
      .set('Authorization', 'Bearer user-1');

    expect(res.status).toBe(404);
  });

  test('returns latest record filtered by status=success', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.getLatest.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        id: 'rec-3',
        userId: 'user-1',
        event: 'export',
        source: 'local-file',
        status: 'success',
        errorCode: null,
        schemaVersion: 1,
        blobTypes: ['addresses'],
        sizeBytes: 1024,
        createdAt: new Date().toISOString(),
      },
    });

    const res = await request(app)
      .get('/vault/backups/latest?status=success')
      .set('Authorization', 'Bearer user-1');

    expect(res.status).toBe(200);
    expect(svc.getLatest).toHaveBeenCalledWith('user-1', 'success');
  });

  test('cross-user isolation: user-2 only sees user-2 records', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;

    svc.getLatest.mockImplementation(async (userId: string) => ({
      ok: true,
      status: 200,
      body: {
        id: `rec-${userId}`,
        userId,
        event: 'export',
        source: 'local-file',
        status: 'success',
        errorCode: null,
        schemaVersion: 1,
        blobTypes: [],
        sizeBytes: 0,
        createdAt: new Date().toISOString(),
      },
    }));

    const resA = await request(app)
      .get('/vault/backups/latest')
      .set('Authorization', 'Bearer user-1');
    const resB = await request(app)
      .get('/vault/backups/latest')
      .set('Authorization', 'Bearer user-2');

    expect(resA.body.userId).toBe('user-1');
    expect(resB.body.userId).toBe('user-2');
  });

  test('returns paginated history', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.listHistory.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: { items: [], nextCursor: null },
    });

    const res = await request(app)
      .get('/vault/backups')
      .set('Authorization', 'Bearer user-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  test('returns 422 when limit exceeds max', async () => {
    const app = makeApp();
    const svc = require('../services/VaultBackupService').default;
    svc.listHistory.mockResolvedValueOnce({
      ok: false,
      status: 422,
      body: { message: 'limit must be between 1 and 100' },
    });

    const res = await request(app)
      .get('/vault/backups?limit=500')
      .set('Authorization', 'Bearer user-1');

    expect(res.status).toBe(422);
  });
});
