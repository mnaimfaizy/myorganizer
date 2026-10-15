import { describe, expect, test } from '@jest/globals';
import {
  compareMobileRelease,
  decideVersionFloor,
  parseClientHeader,
  parseVersionFloor,
} from './versionFloor';

describe('compareMobileRelease', () => {
  test.each([
    ['2.0.0', '1.99.99'],
    ['1.3.0', '1.2.99'],
    ['1.2.4', '1.2.3'],
  ])(
    'orders %s above %s, with the sign flipped when swapped',
    (higher, lower) => {
      expect(compareMobileRelease(higher, lower)).toBeGreaterThan(0);
      expect(compareMobileRelease(lower, higher)).toBeLessThan(0);
    },
  );

  test('returns zero for equal versions', () => {
    expect(compareMobileRelease('1.2.3', '1.2.3')).toBe(0);
  });

  test.each([
    ['1.2', '1.2.0'],
    ['v1.0.0', '1.0.0'],
    ['1.2.0-rc.1', '1.2.0'],
    ['1.2.0', '1.2'],
    ['1.2.0', 'v1.0.0'],
    ['1.2.0', '1.2.0-rc.1'],
  ])(
    'throws a TypeError when either argument is not X.Y.Z (%j, %j)',
    (left, right) => {
      expect(() => compareMobileRelease(left, right)).toThrow(TypeError);
    },
  );
});

describe('parseVersionFloor', () => {
  test('trims surrounding whitespace before reading the floor', () => {
    expect(parseVersionFloor('  1.2.0 ')).toEqual({
      kind: 'floor',
      version: '1.2.0',
    });
  });

  test.each([['01.2.0'], ['1.2.0-rc.1'], ['99999999999999999999.0.0']])(
    'reads %j as an invalid floor, not as off',
    (raw) => {
      expect(parseVersionFloor(raw)).toEqual({ kind: 'invalid', raw });
    },
  );
});

describe('parseClientHeader', () => {
  test('reports a component beyond the safe integer range as malformed with its platform', () => {
    expect(parseClientHeader('mobile/99999999999999999999.0.0 (ios)')).toEqual({
      kind: 'malformed',
      platform: 'ios',
    });
  });

  test('distinguishes an absent header from an empty one', () => {
    expect(parseClientHeader(undefined)).toEqual({ kind: 'absent' });
    expect(parseClientHeader('')).toEqual({
      kind: 'malformed',
      platform: null,
    });
  });
});

describe('decideVersionFloor with the lowest floor', () => {
  test.each([
    ['mobile/0.0.0 (android)'],
    ['mobile/0.0.1 (ios)'],
    ['mobile/1.0.0 (android)'],
    ['mobile/10.20.30 (ios)'],
  ])('passes the well-formed client %j against a 0.0.0 floor', (header) => {
    const floor = parseVersionFloor('0.0.0');

    expect(decideVersionFloor(floor, parseClientHeader(header))).toEqual({
      kind: 'pass',
    });
  });
});
