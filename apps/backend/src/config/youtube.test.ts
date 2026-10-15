import { describe, expect, test } from '@jest/globals';

import { getYouTubeAccessCeiling } from './youtube';

describe('getYouTubeAccessCeiling', () => {
  test('defaults to 25 when the variable is unset', () => {
    expect(getYouTubeAccessCeiling({})).toBe(25);
  });

  test('reads an explicit positive integer', () => {
    expect(getYouTubeAccessCeiling({ YOUTUBE_ACCESS_CEILING: '40' })).toBe(40);
  });

  test('trims surrounding whitespace before reading the value', () => {
    expect(getYouTubeAccessCeiling({ YOUTUBE_ACCESS_CEILING: ' 12 ' })).toBe(
      12,
    );
  });

  test.each([
    '',
    '   ',
    '0',
    '-3',
    '2.5',
    'abc',
    '1e3',
    '99999999999999999999',
  ])('falls back to the default for invalid value %p', (value) => {
    expect(getYouTubeAccessCeiling({ YOUTUBE_ACCESS_CEILING: value })).toBe(25);
  });
});
