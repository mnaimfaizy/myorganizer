import { dateInputToIso, isoToDateInput, todayAsDateInput } from './date';

describe('isoToDateInput', () => {
  it('should return the date portion for a full ISO string at midnight', () => {
    expect(isoToDateInput('2024-01-15T00:00:00.000Z')).toBe('2024-01-15');
  });

  it('should return the date portion for a full ISO string with time', () => {
    expect(isoToDateInput('2024-12-31T23:59:59.999Z')).toBe('2024-12-31');
  });

  it('should return the same value for a date-only string', () => {
    expect(isoToDateInput('2024-01-15')).toBe('2024-01-15');
  });

  it('should return the original date portion for an ISO string with offset', () => {
    expect(isoToDateInput('2024-01-14T14:00:00.000+10:00')).toBe('2024-01-14');
  });

  it('should return an empty string for undefined', () => {
    expect(isoToDateInput(undefined)).toBe('');
  });

  it('should return an empty string for an empty string', () => {
    expect(isoToDateInput('')).toBe('');
  });
});

describe('dateInputToIso', () => {
  it('should return a full ISO string for a valid date-only string', () => {
    expect(dateInputToIso('2024-01-15')).toBe('2024-01-15T00:00:00.000Z');
  });

  it('should return a full ISO string for another valid date-only string', () => {
    expect(dateInputToIso('2024-12-31')).toBe('2024-12-31T00:00:00.000Z');
  });

  it('should return full ISO string for a full ISO string input', () => {
    expect(dateInputToIso('2024-01-15T00:00:00.000Z')).toBe(
      '2024-01-15T00:00:00.000Z',
    );
  });

  it('should return undefined for undefined input', () => {
    expect(dateInputToIso(undefined)).toBeUndefined();
  });

  it('should return undefined for an empty string', () => {
    expect(dateInputToIso('')).toBeUndefined();
  });

  it('should return undefined for a whitespace-only string', () => {
    expect(dateInputToIso('   ')).toBeUndefined();
  });

  it('should return undefined for a non-date string', () => {
    expect(dateInputToIso('not-a-date')).toBeUndefined();
  });

  it('should return undefined for an invalid calendar date string', () => {
    expect(dateInputToIso('2024-13-01')).toBeUndefined();
  });

  it('should return undefined for an impossible calendar day rollover string', () => {
    expect(dateInputToIso('2024-02-30')).toBeUndefined();
  });
});

describe('todayAsDateInput', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return a string in YYYY-MM-DD format', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 5, 9, 30, 0));

    expect(todayAsDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayAsDateInput()).toBe('2024-01-05');
  });

  it('should return the same date as the local date parts from Date', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 15, 18, 30, 0));

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;

    expect(todayAsDateInput()).toBe(expected);
  });
});
