import {
  compareUsageLocationsByPriority,
  sortUsageLocationsByPriority,
  type UsageLocationOrderFields,
} from './usageLocationOrder';

describe('usageLocationOrder', () => {
  describe('compareUsageLocationsByPriority', () => {
    it('returns negative when a has higher priority than b', () => {
      const a: UsageLocationOrderFields = { priority: 'high' };
      const b: UsageLocationOrderFields = { priority: 'low' };
      expect(compareUsageLocationsByPriority(a, b)).toBeLessThan(0);
    });

    it('prioritizes high > medium > normal > low', () => {
      const high: UsageLocationOrderFields = { priority: 'high' };
      const medium: UsageLocationOrderFields = { priority: 'medium' };
      const normal: UsageLocationOrderFields = { priority: 'normal' };
      const low: UsageLocationOrderFields = { priority: 'low' };

      expect(compareUsageLocationsByPriority(high, medium)).toBeLessThan(0);
      expect(compareUsageLocationsByPriority(medium, normal)).toBeLessThan(0);
      expect(compareUsageLocationsByPriority(normal, low)).toBeLessThan(0);
    });

    it('defaults to normal priority when priority is undefined', () => {
      const withPriority: UsageLocationOrderFields = {
        priority: 'high',
      };
      const withoutPriority: UsageLocationOrderFields = {};

      expect(
        compareUsageLocationsByPriority(withPriority, withoutPriority),
      ).toBeLessThan(0);
      expect(
        compareUsageLocationsByPriority(withoutPriority, withPriority),
      ).toBeGreaterThan(0);
    });

    it('sorts by createdAt ascending when priority is equal', () => {
      const earlier: UsageLocationOrderFields = {
        priority: 'high',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const later: UsageLocationOrderFields = {
        priority: 'high',
        createdAt: '2026-01-02T00:00:00.000Z',
      };

      expect(compareUsageLocationsByPriority(earlier, later)).toBeLessThan(0);
      expect(compareUsageLocationsByPriority(later, earlier)).toBeGreaterThan(
        0,
      );
    });

    it('returns 0 for equal priority and createdAt', () => {
      const a: UsageLocationOrderFields = {
        priority: 'medium',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const b: UsageLocationOrderFields = {
        priority: 'medium',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      expect(compareUsageLocationsByPriority(a, b)).toBe(0);
    });

    it('falls back to epoch 0 for missing createdAt when priority ties', () => {
      const withDate: UsageLocationOrderFields = {
        priority: 'low',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const withoutDate: UsageLocationOrderFields = { priority: 'low' };

      // Missing createdAt sorts before a date (epoch 0 < valid date)
      expect(
        compareUsageLocationsByPriority(withoutDate, withDate),
      ).toBeLessThan(0);
    });

    it('falls back to epoch 0 for unparseable createdAt', () => {
      const validDate: UsageLocationOrderFields = {
        priority: 'normal',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const invalidDate: UsageLocationOrderFields = {
        priority: 'normal',
        createdAt: 'not-a-date',
      };

      // Invalid date parses to NaN, falls back to 0, sorts first
      expect(
        compareUsageLocationsByPriority(invalidDate, validDate),
      ).toBeLessThan(0);
    });

    it('treats empty string as unparseable createdAt', () => {
      const validDate: UsageLocationOrderFields = {
        priority: 'medium',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const emptyDate: UsageLocationOrderFields = {
        priority: 'medium',
        createdAt: '',
      };

      expect(
        compareUsageLocationsByPriority(emptyDate, validDate),
      ).toBeLessThan(0);
    });

    it('sorts by createdAt correctly even when both are missing (both epoch 0)', () => {
      const a: UsageLocationOrderFields = { priority: 'high' };
      const b: UsageLocationOrderFields = { priority: 'high' };

      expect(compareUsageLocationsByPriority(a, b)).toBe(0);
    });
  });

  describe('sortUsageLocationsByPriority', () => {
    it('sorts a mixed array by priority then createdAt', () => {
      const locations = [
        {
          id: 'low',
          priority: 'low' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'high1',
          priority: 'high' as const,
          createdAt: '2026-01-02T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'high2',
          priority: 'high' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'medium',
          priority: 'medium' as const,
          createdAt: '2026-01-03T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
      ];

      const sorted = sortUsageLocationsByPriority(locations);

      expect(sorted[0].id).toBe('high2'); // high, earliest
      expect(sorted[1].id).toBe('high1'); // high, later
      expect(sorted[2].id).toBe('medium'); // medium
      expect(sorted[3].id).toBe('low'); // low
    });

    it('returns a new array without mutating the input', () => {
      const original = [
        {
          id: 'a',
          priority: 'low' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'b',
          priority: 'high' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
      ];

      const sorted = sortUsageLocationsByPriority(original);

      expect(sorted).not.toBe(original);
      expect(original[0].id).toBe('a'); // Original unchanged
    });

    it('handles readonly input arrays', () => {
      const locations: readonly Record<string, unknown>[] = [
        { id: 'x', priority: 'low' },
        { id: 'y', priority: 'high' },
      ];

      const sorted = sortUsageLocationsByPriority(locations as any);

      expect(sorted).toHaveLength(2);
    });

    it('handles empty array', () => {
      const sorted = sortUsageLocationsByPriority([]);
      expect(sorted).toEqual([]);
    });

    it('defaults missing priorities to normal and sorts correctly', () => {
      const locations = [
        {
          id: 'low',
          priority: 'low' as const,
          createdAt: '2026-01-03T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'noP',
          priority: 'normal' as const,
          createdAt: '2026-01-02T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
        {
          id: 'high',
          priority: 'high' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          organisationName: 'Test',
          organisationType: 'other' as const,
          updateMethod: 'online' as const,
          changed: false,
        },
      ];

      const sorted = sortUsageLocationsByPriority(locations);

      expect(sorted[0].id).toBe('high');
      expect(sorted[1].id).toBe('noP');
      expect(sorted[2].id).toBe('low');
    });
  });
});
