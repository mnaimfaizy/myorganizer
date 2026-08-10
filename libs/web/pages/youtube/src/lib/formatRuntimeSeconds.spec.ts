import { formatRuntimeSeconds } from './formatRuntimeSeconds';

describe('formatRuntimeSeconds', () => {
  it('formats seconds as M:SS', () => {
    expect(formatRuntimeSeconds(0)).toBe('0:00');
    expect(formatRuntimeSeconds(5)).toBe('0:05');
    expect(formatRuntimeSeconds(59)).toBe('0:59');
    expect(formatRuntimeSeconds(60)).toBe('1:00');
    expect(formatRuntimeSeconds(65)).toBe('1:05');
    expect(formatRuntimeSeconds(125)).toBe('2:05');
  });

  it('pads seconds with leading zero', () => {
    expect(formatRuntimeSeconds(1)).toBe('0:01');
    expect(formatRuntimeSeconds(9)).toBe('0:09');
    expect(formatRuntimeSeconds(61)).toBe('1:01');
    expect(formatRuntimeSeconds(601)).toBe('10:01');
  });

  it('handles values over an hour', () => {
    // 1 hour = 3600 seconds, formats as 60:00 (not H:MM:SS)
    expect(formatRuntimeSeconds(3600)).toBe('60:00');
    // 1 hour 1 second = 3601 seconds, formats as 60:01
    expect(formatRuntimeSeconds(3601)).toBe('60:01');
    // 2 hours = 7200 seconds, formats as 120:00
    expect(formatRuntimeSeconds(7200)).toBe('120:00');
  });

  it('returns empty string for null', () => {
    expect(formatRuntimeSeconds(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRuntimeSeconds(undefined)).toBe('');
  });

  it('returns empty string for negative numbers', () => {
    expect(formatRuntimeSeconds(-1)).toBe('');
    expect(formatRuntimeSeconds(-60)).toBe('');
  });

  it('returns empty string for non-finite numbers', () => {
    expect(formatRuntimeSeconds(NaN)).toBe('');
    expect(formatRuntimeSeconds(Infinity)).toBe('');
    expect(formatRuntimeSeconds(-Infinity)).toBe('');
  });
});
