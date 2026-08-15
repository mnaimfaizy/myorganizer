/**
 * Civil-date helpers for scheduling that must happen on the User's local day
 * rather than the server's. The digest picks a preferred weekday and stamps a
 * delivery period; both must agree with the calendar the User is looking at.
 */

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** The calendar date showing on a wall clock in `timeZone`. Invalid zones fall back to UTC. */
export function civilDateIn(date: Date, timeZone: string | null): CivilDate {
  const zone = timeZone ?? 'UTC';
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  } catch {
    // An unknown IANA zone must not stop the whole worker for one User.
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  }

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return { year: read('year'), month: read('month'), day: read('day') };
}

/** Day of week for a civil date, 0 = Sunday .. 6 = Saturday. */
export function weekdayOf({ year, month, day }: CivilDate): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Day of week in `timeZone`, 0 = Sunday .. 6 = Saturday. */
export function localWeekday(date: Date, timeZone: string | null): number {
  return weekdayOf(civilDateIn(date, timeZone));
}

/**
 * ISO-8601 week key for the User's local date, e.g. `2026-W33`. Used as the
 * digest period so one local week can produce at most one delivery, even when
 * the worker runs either side of a UTC midnight.
 */
export function isoWeekKey(date: Date, timeZone: string | null): string {
  const { year, month, day } = civilDateIn(date, timeZone);
  const target = new Date(Date.UTC(year, month - 1, day));

  // Shift to the Thursday of this ISO week; its calendar year is the ISO year.
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);

  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
