import {
  mergeUnknownFields,
  unknownFieldsOf,
  withUnknownFields,
} from './unknownFields';

const KNOWN = { id: true, name: true } as const;

describe('unknownFields', () => {
  describe('unknownFieldsOf', () => {
    it('returns only the keys the table does not name, with values as stored', () => {
      const raw = { id: '1', name: 'Milk', futureField: { nested: [1, 2] } };

      expect(unknownFieldsOf(raw, KNOWN)).toEqual({
        futureField: { nested: [1, 2] },
      });
    });

    it('returns no fields for null, arrays, and primitives', () => {
      expect(unknownFieldsOf(null, KNOWN)).toEqual({});
      expect(unknownFieldsOf(undefined, KNOWN)).toEqual({});
      expect(unknownFieldsOf(['a', 'b'], KNOWN)).toEqual({});
      expect(unknownFieldsOf('text', KNOWN)).toEqual({});
      expect(unknownFieldsOf(42, KNOWN)).toEqual({});
    });

    it('keeps a __proto__ key as own data and leaves the prototype alone', () => {
      const raw = JSON.parse('{"__proto__":{"polluted":1},"x":1}');

      const result = unknownFieldsOf(raw, KNOWN);

      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(
        Object.getOwnPropertyDescriptor(result, '__proto__')?.value,
      ).toEqual({ polluted: 1 });
      expect(result['x']).toBe(1);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });

  describe('withUnknownFields', () => {
    it('overlays the validated fields on the unknown fields of the raw value', () => {
      const raw = { id: '1', name: 'Raw name', futureField: 'kept' };
      const fields = { id: '1', name: 'Validated name' };

      expect(withUnknownFields(raw, KNOWN, fields)).toEqual({
        id: '1',
        name: 'Validated name',
        futureField: 'kept',
      });
    });

    it('does not restore a known field from raw when the validated fields dropped it', () => {
      const raw = { id: '1', name: 'Invalid name stored', futureField: 'kept' };
      const fields: { id: string; name?: string } = { id: '1' };

      const result = withUnknownFields(raw, KNOWN, fields);

      expect(result).toEqual({ id: '1', futureField: 'kept' });
      expect(result).not.toHaveProperty('name');
    });
  });

  describe('mergeUnknownFields', () => {
    it('unions the unknown fields of both copies and keeps preferred on a shared key', () => {
      const preferred = { id: '1', shared: 'preferred', onlyPreferred: 1 };
      const other = { id: '1', shared: 'other', onlyOther: 2 };

      expect(mergeUnknownFields(preferred, other, KNOWN)).toEqual({
        shared: 'preferred',
        onlyPreferred: 1,
        onlyOther: 2,
      });
    });
  });
});
