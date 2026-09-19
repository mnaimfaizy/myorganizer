export type Env = Record<string, string | undefined>;

function parseBoolean(value: string | undefined): boolean {
  const raw = (value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Explicit backend switch for YouTube (ADR 0091). Defaults to unavailable
 * when unset, so a freshly configured production stays off until someone
 * deliberately turns it on.
 */
export function isYouTubeAvailable(env: Env = process.env): boolean {
  return parseBoolean(env.YOUTUBE_AVAILABLE);
}
