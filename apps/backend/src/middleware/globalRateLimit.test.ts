import express from 'express';
import request from 'supertest';
import {
  getGlobalRateLimitConfigFromEnv,
  maybeCreateGlobalApiRateLimiterFromEnv,
} from './globalRateLimit';

describe('global API rate limiting', () => {
  it('is disabled by default', () => {
    const config = getGlobalRateLimitConfigFromEnv({});
    expect(config.enabled).toBe(false);

    const limiter = maybeCreateGlobalApiRateLimiterFromEnv({});
    expect(limiter).toBeNull();
  });

  it('returns 429 after exceeding RATE_LIMIT_MAX', async () => {
    const limiter = maybeCreateGlobalApiRateLimiterFromEnv({
      ENABLE_GLOBAL_RATE_LIMIT: 'true',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '2',
    });

    if (!limiter) {
      throw new Error('Expected rate limiter to be enabled');
    }

    const app = express();
    const api = express.Router();

    api.use(limiter);
    api.get('/ping', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.use('/api/v1', api);

    const r1 = await request(app).get('/api/v1/ping');
    const r2 = await request(app).get('/api/v1/ping');
    const r3 = await request(app).get('/api/v1/ping');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.body?.message).toBe('Too many requests');
  });
});
