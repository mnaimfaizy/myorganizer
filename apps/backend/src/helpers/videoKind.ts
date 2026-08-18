/**
 * Runtime-based classification of Cached Uploads into Shorts and long-form.
 *
 * Kept apart from the services so that both the sync path and the digest
 * worker can share one definition of "long-form" without the digest importing
 * the sync service — the two workers are deliberately independent.
 */
/**
 * Longest runtime still treated as a Short.
 *
 * The YouTube Data API exposes no Shorts flag, and Shorts arrive in the ordinary
 * uploads playlist alongside long-form uploads, so runtime is the only signal
 * available without a per-video web request. YouTube's own Shorts ceiling is
 * three minutes, so that is the threshold used here.
 *
 * The trade-off is deliberate and one-directional: a genuinely short long-form
 * upload (a three-minute trailer, say) is classified as a Short and lands on the
 * budgeted page. That is the safer failure — the point of the split is keeping
 * short-form out of the focused long-form home, and an over-eager cap costs a
 * User some budget rather than letting the doom-scroll surface leak back in.
 *
 * `durationSeconds` is stored rather than a computed boolean precisely so this
 * threshold can be retuned later without re-syncing every User's library.
 */
export const SHORTS_MAX_DURATION_SECONDS = 180;

/**
 * Parses an ISO 8601 duration (`PT1M30S`, `PT2H3M4S`, `P1DT2H`) into seconds.
 *
 * Returns null for anything unparseable rather than guessing — an unclassified
 * upload is treated as long-form, so a parse failure keeps a video visible on
 * the home rather than hiding it behind the Shorts budget.
 */
export function parseIso8601DurationSeconds(
  duration: string | null | undefined,
): number | null {
  if (!duration) return null;
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      duration,
    );
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;
  const total =
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) ? Math.round(total) : null;
}

/**
 * Whether a Cached Upload counts as a Short.
 *
 * An unclassified upload (null duration — cached before duration collection, or
 * a parse failure) is **not** a Short. Unknown must never be treated as Short,
 * or a sync gap would quietly move someone's library behind the daily budget.
 */
export function isShortDuration(
  durationSeconds: number | null | undefined,
): boolean {
  return (
    typeof durationSeconds === 'number' &&
    durationSeconds > 0 &&
    durationSeconds <= SHORTS_MAX_DURATION_SECONDS
  );
}

/** Which slice of the library a query wants. */
export type VideoKind = 'short' | 'long' | 'all';

/**
 * Prisma `where` fragment selecting a slice of the library by runtime.
 * `long` deliberately includes unclassified rows.
 */
export function videoKindWhere(kind: VideoKind): Record<string, unknown> {
  if (kind === 'short') {
    return { durationSeconds: { gt: 0, lte: SHORTS_MAX_DURATION_SECONDS } };
  }
  if (kind === 'long') {
    return {
      OR: [
        { durationSeconds: null },
        { durationSeconds: { gt: SHORTS_MAX_DURATION_SECONDS } },
        { durationSeconds: { lte: 0 } },
      ],
    };
  }
  return {};
}
