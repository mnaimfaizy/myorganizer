import { Env, parseBoolean } from './env';

/** Lifetime ceiling on Users ever granted YouTube Access (ADR 0129). */
export const DEFAULT_YOUTUBE_ACCESS_CEILING = 25;

/**
 * Explicit backend switch for YouTube (ADR 0091). Defaults to unavailable
 * when unset, so a freshly configured production stays off until someone
 * deliberately turns it on.
 */
export function isYouTubeAvailable(env: Env = process.env): boolean {
  return parseBoolean(env.YOUTUBE_AVAILABLE);
}

/**
 * Maximum number of Users ever granted YouTube Access (ADR 0129). A missing,
 * blank, or non-positive-integer value falls back to the default.
 */
export function getYouTubeAccessCeiling(env: Env = process.env): number {
  const raw = (env.YOUTUBE_ACCESS_CEILING ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    return DEFAULT_YOUTUBE_ACCESS_CEILING;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    return DEFAULT_YOUTUBE_ACCESS_CEILING;
  }
  return value;
}
