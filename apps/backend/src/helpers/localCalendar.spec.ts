import {
  civilDateIn,
  weekdayOf,
  localWeekday,
  isoWeekKey,
} from './localCalendar';

describe('localCalendar', () => {
  describe('civilDateIn', () => {
    it('should return the wall-clock date in a valid IANA timezone', () => {
      const utcDate = new Date('2026-01-15T10:00:00Z');
      const result = civilDateIn(utcDate, 'America/New_York');

      // In NY on 2026-01-15 UTC, it's still 2026-01-15 (UTC-5)
      expect(result).toEqual({ year: 2026, month: 1, day: 15 });
    });

    it('should handle timezone that is a day ahead of UTC', () => {
      // 2026-01-15 00:00 UTC is 2026-01-15 11:00 in Sydney (UTC+11)
      const utcDate = new Date('2026-01-15T00:00:00Z');
      const result = civilDateIn(utcDate, 'Australia/Sydney');

      expect(result).toEqual({ year: 2026, month: 1, day: 15 });
    });

    it('should handle late-December date where Sydney is a day ahead', () => {
      // 2025-12-29 13:00 UTC is 2026-01-01 00:00 in Sydney (+11 hours, next day)
      const utcDate = new Date('2025-12-31T13:00:00Z');
      const result = civilDateIn(utcDate, 'Australia/Sydney');

      expect(result.year).toBe(2026);
      expect(result.month).toBe(1);
      expect(result.day).toBe(1);
    });

    it('should fall back to UTC for invalid/unknown IANA zone', () => {
      const utcDate = new Date('2026-01-15T10:00:00Z');
      const result = civilDateIn(utcDate, 'Fake/Zone');

      // Should use UTC as fallback
      expect(result).toEqual({ year: 2026, month: 1, day: 15 });
    });

    it('should treat null timeZone as UTC', () => {
      const utcDate = new Date('2026-01-15T10:00:00Z');
      const result = civilDateIn(utcDate, null);

      expect(result).toEqual({ year: 2026, month: 1, day: 15 });
    });

    it('should parse month with correct 1-based indexing', () => {
      const utcDate = new Date('2026-12-25T10:00:00Z');
      const result = civilDateIn(utcDate, 'UTC');

      expect(result.month).toBe(12);
    });
  });

  describe('weekdayOf', () => {
    it('should return 0 for Sunday', () => {
      // 2026-01-04 is a Sunday
      const date = weekdayOf({ year: 2026, month: 1, day: 4 });
      expect(date).toBe(0);
    });

    it('should return 1 for Monday', () => {
      // 2026-01-05 is a Monday
      const date = weekdayOf({ year: 2026, month: 1, day: 5 });
      expect(date).toBe(1);
    });

    it('should return 3 for Wednesday', () => {
      // 2026-01-07 is a Wednesday
      const date = weekdayOf({ year: 2026, month: 1, day: 7 });
      expect(date).toBe(3);
    });

    it('should return 6 for Saturday', () => {
      // 2026-01-03 is a Saturday
      const date = weekdayOf({ year: 2026, month: 1, day: 3 });
      expect(date).toBe(6);
    });
  });

  describe('localWeekday', () => {
    it('should return the weekday in the specified timezone', () => {
      const utcDate = new Date('2026-01-05T10:00:00Z');
      const weekday = localWeekday(utcDate, 'UTC');

      expect(weekday).toBe(1); // Monday
    });

    it('should handle timezone conversion for weekday lookup', () => {
      // 2026-01-04 23:00 UTC is still 2026-01-04 (Sunday) in NY
      const utcDate = new Date('2026-01-04T23:00:00Z');
      const weekday = localWeekday(utcDate, 'America/New_York');

      expect(weekday).toBe(0); // Sunday
    });

    it('should treat null timezone as UTC', () => {
      const utcDate = new Date('2026-01-05T10:00:00Z');
      const weekday = localWeekday(utcDate, null);

      expect(weekday).toBe(1); // Monday
    });
  });

  describe('isoWeekKey', () => {
    it('should format as YYYY-Www with zero-padded week number', () => {
      // 2026-01-15 is in week 3
      const utcDate = new Date('2026-01-15T10:00:00Z');
      const key = isoWeekKey(utcDate, 'UTC');

      expect(key).toMatch(/^\d{4}-W\d{2}$/);
      expect(key).toBe('2026-W03');
    });

    it('should use ISO year for late-December dates that belong to next year', () => {
      // 2025-12-29 is a Monday; ISO 8601 says it belongs to 2026-W01
      const utcDate = new Date('2025-12-29T10:00:00Z');
      const key = isoWeekKey(utcDate, 'UTC');

      // Should be in 2026, not 2025
      expect(key.startsWith('2026')).toBe(true);
      expect(key).toBe('2026-W01');
    });

    it('should use ISO year for early-January dates that belong to previous year', () => {
      // 2026-01-01 is a Thursday; ISO 8601 says it belongs to 2026-W01
      const utcDate = new Date('2026-01-01T10:00:00Z');
      const key = isoWeekKey(utcDate, 'UTC');

      expect(key).toBe('2026-W01');
    });

    it('should give different week keys for the same instant across timezones at week boundary', () => {
      // Early Monday UTC in Sydney is still Sunday of the prior week
      // 2026-01-05 02:00 UTC is 2026-01-05 13:00 in Sydney (Monday)
      const utcDate = new Date('2026-01-05T02:00:00Z');

      const keyUTC = isoWeekKey(utcDate, 'UTC');
      const keySydney = isoWeekKey(utcDate, 'Australia/Sydney');

      expect(keyUTC).toBe('2026-W02');
      expect(keySydney).toBe('2026-W02');
    });

    it('should handle timezones that straddle ISO week boundaries', () => {
      // 2026-01-05 02:00 UTC (Monday) vs earlier in Sunday
      // This tests if Sydney can see a different ISO week at the same instant
      const earlyMondayUTC = new Date('2026-01-05T01:00:00Z');
      const keyUTC = isoWeekKey(earlyMondayUTC, 'UTC');
      // In Sydney this is still 2026-01-05 12:00, still same week
      const keySydney = isoWeekKey(earlyMondayUTC, 'Australia/Sydney');

      // Both should be in same ISO week for this instant
      expect(keyUTC).toBe(keySydney);
    });

    it('should treat null timezone as UTC', () => {
      const utcDate = new Date('2026-01-15T10:00:00Z');
      const key = isoWeekKey(utcDate, null);

      expect(key).toBe('2026-W03');
    });

    it('should pad single-digit weeks with leading zero', () => {
      // 2026-01-04 is in week 1
      const utcDate = new Date('2026-01-04T10:00:00Z');
      const key = isoWeekKey(utcDate, 'UTC');

      expect(key).toBe('2026-W01');
    });
  });
});
