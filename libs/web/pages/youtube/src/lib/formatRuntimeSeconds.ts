/**
 * Format runtime in seconds as M:SS.
 *
 * Distinct from formatShortsDuration (in shortsBudget.ts), which formats
 * milliseconds as H:MM:SS or M:SS. This formats video runtime in seconds.
 *
 * @param seconds - Runtime in seconds, or null to show nothing
 * @returns Formatted string (M:SS) or empty string if seconds is null/invalid
 */
export function formatRuntimeSeconds(
  seconds: number | null | undefined,
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return '';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
