import {
  formatCalendarDate,
  formatCalendarDateShort,
  formatDayMonth,
  parseCalendarDate,
  toCalendarDate,
} from './calendarDate';

describe('calendarDate', () => {
  it('reads a date-only value as the local calendar day', () => {
    const date = parseCalendarDate('2026-10-14');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(14);
  });

  it('reads the date part of a date-time', () => {
    expect(toCalendarDate(parseCalendarDate('2026-09-29T10:00:00Z')!)).toBe(
      '2026-09-29',
    );
  });

  it('rejects a day the month does not have', () => {
    expect(parseCalendarDate('2026-02-31')).toBeNull();
    expect(parseCalendarDate('not a date')).toBeNull();
  });

  it('round-trips through toCalendarDate', () => {
    expect(toCalendarDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('prints the long form the design uses', () => {
    expect(formatCalendarDate('2026-10-14')).toBe('Wed 14 Oct 2026');
    expect(formatCalendarDateShort('2026-09-29')).toBe('Tue 29 Sep');
  });

  it('adds the year only when it is not the current one', () => {
    const now = new Date(2026, 8, 29);
    expect(formatDayMonth('2026-08-12', now)).toBe('12 Aug');
    expect(formatDayMonth('2027-03-03', now)).toBe('3 Mar 2027');
  });

  it('prints an unreadable value as stored', () => {
    expect(formatCalendarDate('someday')).toBe('someday');
  });
});
