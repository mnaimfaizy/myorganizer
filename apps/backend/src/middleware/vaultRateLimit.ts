import type { RequestHandler } from 'express';

type Counter = { windowStartMs: number; count: number };

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

const counters = new Map<string, Counter>();

function getKey(req: Parameters<RequestHandler>[0]): string {
  const userId = (req as any)?.user?.id;
  if (typeof userId === 'string' && userId.length > 0) {
    return `user:${userId}`;
  }

  const ip = req.ip || (req.socket?.remoteAddress ?? 'unknown');
  return `ip:${ip}`;
}

export const vaultRateLimiter: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = getKey(req);

  const current = counters.get(key);
  if (!current || now - current.windowStartMs >= WINDOW_MS) {
    counters.set(key, { windowStartMs: now, count: 1 });
    next();
    return;
  }

  current.count += 1;
  if (current.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ message: 'Too many requests' });
    return;
  }

  next();
};
