import { parseUserIds } from './userIds';

describe('parseUserIds', () => {
  it('reads no users when nothing is stored', () => {
    expect(parseUserIds(undefined)).toEqual([]);
  });

  it('reads a stored JSON array of user ids in order', () => {
    expect(parseUserIds(JSON.stringify(['user-a', 'user-b']))).toEqual([
      'user-a',
      'user-b',
    ]);
  });

  it.each(['not json', '['])(
    'reads no users, without throwing, when the stored value is malformed (%s)',
    (raw) => {
      expect(parseUserIds(raw)).toEqual([]);
    },
  );

  it.each(['{"a":1}', '"x"', 'null', '42'])(
    'reads no users when the stored JSON is not an array (%s)',
    (raw) => {
      expect(parseUserIds(raw)).toEqual([]);
    },
  );

  it('keeps only the string entries of an array', () => {
    expect(parseUserIds('["a",1,null,"b",{}]')).toEqual(['a', 'b']);
  });
});
