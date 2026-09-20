import { Env, parseBoolean } from './env';

/**
 * Explicit backend switch for YouTube (ADR 0091). Defaults to unavailable
 * when unset, so a freshly configured production stays off until someone
 * deliberately turns it on.
 */
export function isYouTubeAvailable(env: Env = process.env): boolean {
  return parseBoolean(env.YOUTUBE_AVAILABLE);
}
