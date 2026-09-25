import { stableStringify } from './stableStringify';

describe('stableStringify', () => {
  test('produces identical output regardless of object key order', () => {
    const obj1 = stableStringify({ a: 1, b: 2, c: 3 });
    const obj2 = stableStringify({ c: 3, a: 1, b: 2 });
    const obj3 = stableStringify({ b: 2, c: 3, a: 1 });

    expect(obj1).toEqual(obj2);
    expect(obj2).toEqual(obj3);
  });

  test('drops undefined values from objects', () => {
    const withUndefined = stableStringify({ a: 1, b: undefined, c: 3 });
    const withoutUndefined = stableStringify({ a: 1, c: 3 });

    expect(withUndefined).toEqual(withoutUndefined);
  });

  test('converts top-level undefined to "null"', () => {
    expect(stableStringify(undefined)).toBe('null');
  });

  test('converts null to "null"', () => {
    expect(stableStringify(null)).toBe('null');
  });

  test('encodes NaN as a special sentinel', () => {
    expect(stableStringify(Number.NaN)).toBe('{"$number":"NaN"}');
  });

  test('encodes Infinity as a special sentinel', () => {
    expect(stableStringify(Number.POSITIVE_INFINITY)).toBe(
      '{"$number":"Infinity"}',
    );
  });

  test('encodes negative Infinity as a special sentinel', () => {
    expect(stableStringify(Number.NEGATIVE_INFINITY)).toBe(
      '{"$number":"-Infinity"}',
    );
  });

  test('handles nested objects with sorted keys', () => {
    const obj1 = stableStringify({ x: { b: 2, a: 1 }, y: 3 });
    const obj2 = stableStringify({ y: 3, x: { a: 1, b: 2 } });

    expect(obj1).toEqual(obj2);
  });

  test('preserves array element order', () => {
    const arr1 = stableStringify([1, 2, 3]);
    const arr2 = stableStringify([1, 2, 3]);
    const arr3 = stableStringify([3, 2, 1]);

    expect(arr1).toEqual(arr2);
    expect(arr1).not.toEqual(arr3);
  });

  test('handles mixed structures with objects and arrays', () => {
    const mixed = stableStringify({
      items: [{ z: 26, a: 1 }, { b: 2 }],
      name: 'test',
    });

    const rearranged = stableStringify({
      name: 'test',
      items: [{ a: 1, z: 26 }, { b: 2 }],
    });

    expect(mixed).toEqual(rearranged);
  });

  test('converts regular numbers to JSON string representation', () => {
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(0)).toBe('0');
    expect(stableStringify(-3.14)).toMatch(/-3\.14/);
  });

  test('converts strings properly', () => {
    expect(stableStringify('hello')).toBe('"hello"');
  });

  test('converts booleans properly', () => {
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(false)).toBe('false');
  });
});
