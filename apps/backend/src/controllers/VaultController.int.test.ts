import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { ValidateError } from 'tsoa';

jest.mock('../middleware/authentication', () => {
  return {
    expressAuthentication: async (req: any) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        const err: any = new Error('No token provided');
        err.status = 401;
        throw err;
      }

      req.user = { id: 'user-1' };
      return req.user;
    },
  };
});

jest.mock('../services/VaultService', () => {
  return {
    __esModule: true,
    default: {
      getVaultMeta: jest.fn(),
      putVaultMeta: jest.fn(),
      getBlob: jest.fn(),
      putBlob: jest.fn(),
      exportVault: jest.fn(),
      importVault: jest.fn(),
    },
  };
});

function makeApp() {
  // Ensure mocks are applied before importing the generated routes.

  const { RegisterRoutes } = require('../routes/routes');

  const app = express();
  app.use(bodyParser.json({ limit: '2mb' }));
  RegisterRoutes(app);

  app.use(function tsoaErrorHandler(
    err: unknown,
    _req: any,
    res: any,
    next: any
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

describe('VaultController (HTTP integration)', () => {
  const meta = {
    version: 1,
    kdf_name: 'PBKDF2',
    kdf_salt: 'salt',
    kdf_params: { iterations: 1 },
    wrapped_mk_passphrase: { any: 'shape' },
    wrapped_mk_recovery: { any: 'shape' },
  };

  const blob = {
    version: 1,
    iv: Buffer.alloc(12).toString('base64'),
    ciphertext: Buffer.from('ciphertext').toString('base64'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires auth for GET /vault', async () => {
    const app = makeApp();

    const res = await request(app).get('/vault');

    expect(res.status).toBe(401);
  });

  test('returns 404 on missing vault meta', async () => {
    const app = makeApp();

    const vaultService = require('../services/VaultService').default;

    vaultService.getVaultMeta.mockResolvedValueOnce({
      ok: false,
      status: 404,
      body: { message: 'Vault not found' },
    });

    const res = await request(app)
      .get('/vault')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Vault not found' });
  });

  test('passes If-Match to PUT /vault and returns 201 on create', async () => {
    const app = makeApp();

    const vaultService = require('../services/VaultService').default;

    vaultService.putVaultMeta.mockResolvedValueOnce({
      ok: true,
      status: 201,
      body: {
        ok: true,
        etag: 'W/"1"',
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    });

    const res = await request(app)
      .put('/vault')
      .set('Authorization', 'Bearer test')
      .set('If-Match', 'W/"0"')
      .send({ meta });

    expect(res.status).toBe(201);
    expect(vaultService.putVaultMeta).toHaveBeenCalledWith(
      'user-1',
      meta,
      'W/"0"'
    );
  });

  test('returns 422 when PUT /vault/blob/:type body type mismatches path type', async () => {
    const app = makeApp();

    const vaultService = require('../services/VaultService').default;

    const res = await request(app)
      .put('/vault/blob/addresses')
      .set('Authorization', 'Bearer test')
      .send({ type: 'mobileNumbers', blob });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ message: 'Body type must match path type' });
    expect(vaultService.putBlob).not.toHaveBeenCalled();
  });

  test('returns 200 for GET /vault/blob/:type when service returns ok', async () => {
    const app = makeApp();

    const vaultService = require('../services/VaultService').default;

    vaultService.getBlob.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        type: 'addresses',
        blob,
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        etag: 'W/"1"',
      },
    });

    const res = await request(app)
      .get('/vault/blob/addresses')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('addresses');
    expect(vaultService.getBlob).toHaveBeenCalledWith('user-1', 'addresses');
  });
});
