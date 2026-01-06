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

  it('parses ENABLE_GLOBAL_RATE_LIMIT robustly', () => {
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: 'true' })
        .enabled
    ).toBe(true);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: '  YES ' })
        .enabled
    ).toBe(true);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: '1' }).enabled
    ).toBe(true);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: 'on' })
        .enabled
    ).toBe(true);

    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: 'false' })
        .enabled
    ).toBe(false);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: '0' }).enabled
    ).toBe(false);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: 'off' })
        .enabled
    ).toBe(false);
    expect(
      getGlobalRateLimitConfigFromEnv({ ENABLE_GLOBAL_RATE_LIMIT: 'no' })
        .enabled
    ).toBe(false);
  });

  it('falls back for invalid RATE_LIMIT_* values', () => {
    const defaults = getGlobalRateLimitConfigFromEnv({});

    expect(
      getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_WINDOW_MS: 'abc' }).windowMs
    ).toBe(defaults.windowMs);
    expect(
      getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_WINDOW_MS: '-1' }).windowMs
    ).toBe(defaults.windowMs);
    expect(
      getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_WINDOW_MS: '0' }).windowMs
    ).toBe(defaults.windowMs);
    expect(
      getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_WINDOW_MS: '10ms' }).windowMs
    ).toBe(defaults.windowMs);
    expect(
      getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_WINDOW_MS: ' 60000 ' })
        .windowMs
    ).toBe(60000);

    expect(getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_MAX: 'abc' }).max).toBe(
      defaults.max
    );
    expect(getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_MAX: '-1' }).max).toBe(
      defaults.max
    );
    expect(getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_MAX: '0' }).max).toBe(
      defaults.max
    );
    expect(getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_MAX: '2.5' }).max).toBe(
      defaults.max
    );
    expect(getGlobalRateLimitConfigFromEnv({ RATE_LIMIT_MAX: ' 2 ' }).max).toBe(
      2
    );
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
