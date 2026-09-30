import {
  toOfferedUserIds,
  withOfferedUserId,
  serializeOfferedUserIds,
} from './biometricOffer';

describe('biometricOffer.ts', () => {
  describe('toOfferedUserIds', () => {
    it('returns empty array when given undefined', () => {
      expect(toOfferedUserIds(undefined)).toEqual([]);
    });

    it('returns empty array when given malformed JSON', () => {
      expect(toOfferedUserIds('not json at all')).toEqual([]);
    });

    it('returns empty array when given a JSON object instead of array', () => {
      expect(toOfferedUserIds('{"a":"b"}')).toEqual([]);
    });

    it('filters out non-string members from array', () => {
      const input = JSON.stringify(['user-1', 42, 'user-2', null, 'user-3']);
      const result = toOfferedUserIds(input);
      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('returns array unchanged for valid string array', () => {
      const users = ['user-a', 'user-b', 'user-c'];
      const input = JSON.stringify(users);
      const result = toOfferedUserIds(input);
      expect(result).toEqual(users);
    });

    it('returns empty array for empty array', () => {
      const input = JSON.stringify([]);
      const result = toOfferedUserIds(input);
      expect(result).toEqual([]);
    });
  });

  describe('withOfferedUserId', () => {
    it('adds a new user id to the list', () => {
      const offered = ['user-a', 'user-b'];
      const result = withOfferedUserId(offered, 'user-c');
      expect(result).toEqual(['user-a', 'user-b', 'user-c']);
    });

    it('returns the same reference when user id already present', () => {
      const offered = ['user-a', 'user-b'];
      const result = withOfferedUserId(offered, 'user-a');
      expect(result).toBe(offered);
    });

    it('adds to empty list', () => {
      const result = withOfferedUserId([], 'user-a');
      expect(result).toEqual(['user-a']);
    });

    it('is idempotent: multiple additions of same user id', () => {
      let result: readonly string[] = [];
      result = withOfferedUserId(result, 'user-a');
      result = withOfferedUserId(result, 'user-a');
      result = withOfferedUserId(result, 'user-a');
      expect(result).toEqual(['user-a']);
    });
  });

  describe('serializeOfferedUserIds', () => {
    it('serializes to JSON string', () => {
      const offered = ['user-a', 'user-b', 'user-c'];
      const serialized = serializeOfferedUserIds(offered);
      expect(JSON.parse(serialized)).toEqual(offered);
    });

    it('round-trips through toOfferedUserIds', () => {
      const users = ['alice', 'bob', 'charlie'];
      const serialized = serializeOfferedUserIds(users);
      const deserialized = toOfferedUserIds(serialized);
      expect(deserialized).toEqual(users);
    });

    it('serializes empty array', () => {
      const serialized = serializeOfferedUserIds([]);
      expect(JSON.parse(serialized)).toEqual([]);
    });
  });
});
