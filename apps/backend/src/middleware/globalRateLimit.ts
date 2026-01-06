import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

type Env = Record<string, string | undefined>;

export type GlobalRateLimitConfig = {
  enabled: boolean;
  windowMs: number;
  max: number;
};

function parseBoolean(value: string | undefined): boolean {
  const raw = (value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const raw = (value ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getGlobalRateLimitConfigFromEnv(
  env: Env = process.env
): GlobalRateLimitConfig {
  return {
    enabled: parseBoolean(env.ENABLE_GLOBAL_RATE_LIMIT),
    windowMs: parseIntOr(env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: parseIntOr(env.RATE_LIMIT_MAX, 300),
  };
}

export function createGlobalApiRateLimiter(
  config: GlobalRateLimitConfig
): RequestHandler | null {
  if (!config.enabled) return null;

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests' },
  });
}

export function maybeCreateGlobalApiRateLimiterFromEnv(
  env: Env = process.env
): RequestHandler | null {
  return createGlobalApiRateLimiter(getGlobalRateLimitConfigFromEnv(env));
}
