import { normalizeTodos } from './todoNormalization';

describe('normalizeTodos', () => {
  it('should return empty for nullish', () => {
    expect(normalizeTodos(null)).toEqual({ value: [], changed: false });
    expect(normalizeTodos(undefined)).toEqual({ value: [], changed: false });
  });

  it('should coerce non-arrays to empty and mark changed', () => {
    expect(normalizeTodos({})).toEqual({ value: [], changed: true });
    expect(normalizeTodos('x')).toEqual({ value: [], changed: true });
    expect(normalizeTodos(123)).toEqual({ value: [], changed: true });
  });

  it('should coerce string items into todo records', () => {
    const res = normalizeTodos(['  buy milk  ']);
    expect(res.value).toHaveLength(1);
    expect(res.value[0].todo).toBe('buy milk');
    expect(typeof res.value[0].id).toBe('string');
    expect(res.changed).toBe(true);
  });

  it('should drop invalid items', () => {
    const res = normalizeTodos([null, 1, {}, { todo: '' }, { todo: '   ' }]);
    expect(res.value).toEqual([]);
    expect(res.changed).toBe(true);
  });

  it('should keep valid items and normalize fields', () => {
    const res = normalizeTodos([
      { id: '  a  ', todo: '  x  ' },
      { id: 'b', todo: 'y' },
    ]);

    expect(res.value[0]).toEqual({ id: 'a', todo: 'x' });
    expect(res.value[1]).toEqual({ id: 'b', todo: 'y' });
    expect(res.changed).toBe(true);
  });

  it('should not mark changed for already-normalized items', () => {
    const res = normalizeTodos([{ id: 'a', todo: 'x' }]);
    expect(res).toEqual({ value: [{ id: 'a', todo: 'x' }], changed: false });
  });
});
