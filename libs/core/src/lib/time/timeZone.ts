/**
 * The browser's IANA time zone, or null when the runtime will not name one.
 *
 * Used wherever the server has to reason about the User's own calendar rather
 * than its own — the weekly YouTube digest picks its send day this way.
 */
export function detectTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
