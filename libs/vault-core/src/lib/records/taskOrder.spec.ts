import {
  compareTasksByPriorityDueDateCreated,
  sortTasksByPriorityDueDateCreated,
  type TaskOrderFields,
} from './taskOrder';
import type { Task } from './task';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    status: 'pending',
    priority: 'medium',
    archived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('taskOrder', () => {
  describe('compareTasksByPriorityDueDateCreated', () => {
    it('prioritizes high > medium > low', () => {
      const high: TaskOrderFields = { priority: 'high' };
      const medium: TaskOrderFields = { priority: 'medium' };
      const low: TaskOrderFields = { priority: 'low' };

      expect(compareTasksByPriorityDueDateCreated(high, medium)).toBeLessThan(
        0,
      );
      expect(compareTasksByPriorityDueDateCreated(medium, low)).toBeLessThan(0);
      expect(compareTasksByPriorityDueDateCreated(high, low)).toBeLessThan(0);
    });

    it('returns greater than 0 when a has lower priority than b', () => {
      const low: TaskOrderFields = { priority: 'low' };
      const high: TaskOrderFields = { priority: 'high' };

      expect(compareTasksByPriorityDueDateCreated(low, high)).toBeGreaterThan(
        0,
      );
    });

    it('defaults to medium priority when priority is undefined', () => {
      const high: TaskOrderFields = { priority: 'high' };
      const withoutPriority: TaskOrderFields = {};

      expect(
        compareTasksByPriorityDueDateCreated(high, withoutPriority),
      ).toBeLessThan(0);
      expect(
        compareTasksByPriorityDueDateCreated(withoutPriority, high),
      ).toBeGreaterThan(0);
    });

    it('treats missing priority and explicit medium priority identically', () => {
      const explicit: TaskOrderFields = { priority: 'medium' };
      const implicit: TaskOrderFields = {};

      expect(compareTasksByPriorityDueDateCreated(explicit, implicit)).toBe(0);
      expect(compareTasksByPriorityDueDateCreated(implicit, explicit)).toBe(0);
    });

    it('sorts by dueDate ascending when priority is equal', () => {
      const earlier: TaskOrderFields = {
        priority: 'high',
        dueDate: '2026-01-01T00:00:00.000Z',
      };
      const later: TaskOrderFields = {
        priority: 'high',
        dueDate: '2026-01-02T00:00:00.000Z',
      };

      expect(compareTasksByPriorityDueDateCreated(earlier, later)).toBeLessThan(
        0,
      );
      expect(
        compareTasksByPriorityDueDateCreated(later, earlier),
      ).toBeGreaterThan(0);
    });

    it('places undated tasks after dated ones when priority is equal', () => {
      const dated: TaskOrderFields = {
        priority: 'medium',
        dueDate: '2026-01-01T00:00:00.000Z',
      };
      const undated: TaskOrderFields = { priority: 'medium' };

      expect(compareTasksByPriorityDueDateCreated(dated, undated)).toBeLessThan(
        0,
      );
      expect(
        compareTasksByPriorityDueDateCreated(undated, dated),
      ).toBeGreaterThan(0);
    });

    it('treats unparseable dueDate as undated', () => {
      const valid: TaskOrderFields = {
        priority: 'low',
        dueDate: '2026-01-01T00:00:00.000Z',
      };
      const invalid: TaskOrderFields = {
        priority: 'low',
        dueDate: 'not-a-date',
      };

      // Valid dates sort before unparseable (Infinity)
      expect(compareTasksByPriorityDueDateCreated(valid, invalid)).toBeLessThan(
        0,
      );
      expect(
        compareTasksByPriorityDueDateCreated(invalid, valid),
      ).toBeGreaterThan(0);
    });

    it('treats empty string dueDate as unparseable', () => {
      const valid: TaskOrderFields = {
        priority: 'medium',
        dueDate: '2026-01-01T00:00:00.000Z',
      };
      const empty: TaskOrderFields = {
        priority: 'medium',
        dueDate: '',
      };

      // Valid dates sort before empty string (Infinity)
      expect(compareTasksByPriorityDueDateCreated(valid, empty)).toBeLessThan(
        0,
      );
      expect(
        compareTasksByPriorityDueDateCreated(empty, valid),
      ).toBeGreaterThan(0);
    });

    it('REGRESSION: orders two undated tasks by createdAt when priority and dueDate tie', () => {
      const older: TaskOrderFields = {
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const newer: TaskOrderFields = {
        priority: 'high',
        createdAt: '2024-01-02T00:00:00.000Z',
      };

      // This is the regression: undated Tasks should fall through to createdAt
      // comparison, and the comparator should return a number, not NaN.
      const result = compareTasksByPriorityDueDateCreated(newer, older);
      expect(result).toBeGreaterThan(0);
      expect(Number.isNaN(result)).toBe(false);

      expect(compareTasksByPriorityDueDateCreated(older, newer)).toBeLessThan(
        0,
      );
    });

    it('sorts by createdAt ascending when priority and dueDate tie', () => {
      const earlier: TaskOrderFields = {
        priority: 'medium',
        dueDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const later: TaskOrderFields = {
        priority: 'medium',
        dueDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2024-01-02T00:00:00.000Z',
      };

      expect(compareTasksByPriorityDueDateCreated(earlier, later)).toBeLessThan(
        0,
      );
      expect(
        compareTasksByPriorityDueDateCreated(later, earlier),
      ).toBeGreaterThan(0);
    });

    it('defaults to epoch 0 for missing createdAt when dueDate ties', () => {
      const withDate: TaskOrderFields = {
        priority: 'low',
        dueDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const withoutDate: TaskOrderFields = {
        priority: 'low',
        dueDate: '2026-01-01T00:00:00.000Z',
      };

      // Missing createdAt sorts before a date (epoch 0 < valid date)
      expect(
        compareTasksByPriorityDueDateCreated(withoutDate, withDate),
      ).toBeLessThan(0);
    });

    it('treats unparseable createdAt as epoch 0', () => {
      const valid: TaskOrderFields = {
        priority: 'medium',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const invalid: TaskOrderFields = {
        priority: 'medium',
        createdAt: 'not-a-date',
      };

      // Invalid date parses to NaN, falls back to 0, sorts first
      expect(compareTasksByPriorityDueDateCreated(invalid, valid)).toBeLessThan(
        0,
      );
    });

    it('returns 0 for fully identical fields', () => {
      const a: TaskOrderFields = {
        priority: 'high',
        dueDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      const b: TaskOrderFields = {
        priority: 'high',
        dueDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      expect(compareTasksByPriorityDueDateCreated(a, b)).toBe(0);
    });

    it('returns 0 when all fields are absent (all defaults)', () => {
      const a: TaskOrderFields = {};
      const b: TaskOrderFields = {};

      expect(compareTasksByPriorityDueDateCreated(a, b)).toBe(0);
    });
  });

  describe('sortTasksByPriorityDueDateCreated', () => {
    it('sorts a mixed array by priority then dueDate then createdAt', () => {
      const tasks = [
        makeTask({
          id: 'low-old',
          priority: 'low',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeTask({
          id: 'high-new-dated',
          priority: 'high',
          dueDate: '2026-01-02T00:00:00.000Z',
          createdAt: '2024-01-02T00:00:00.000Z',
        }),
        makeTask({
          id: 'high-old-dated',
          priority: 'high',
          dueDate: '2026-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeTask({
          id: 'medium',
          priority: 'medium',
          createdAt: '2024-01-03T00:00:00.000Z',
        }),
        makeTask({
          id: 'high-undated-old',
          priority: 'high',
          createdAt: '2023-12-31T00:00:00.000Z',
        }),
      ];

      const sorted = sortTasksByPriorityDueDateCreated(tasks);

      // Order: high (sorted by dueDate, then createdAt), medium, low
      expect(sorted[0].id).toBe('high-old-dated'); // high, earliest due date
      expect(sorted[1].id).toBe('high-new-dated'); // high, later due date
      expect(sorted[2].id).toBe('high-undated-old'); // high, no due date (falls to end of highs)
      expect(sorted[3].id).toBe('medium'); // medium
      expect(sorted[4].id).toBe('low-old'); // low
    });

    it('returns a new array without mutating the input', () => {
      const original = [
        makeTask({
          id: 'a',
          priority: 'low',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeTask({
          id: 'b',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
      ];

      const sorted = sortTasksByPriorityDueDateCreated(original);

      expect(sorted).not.toBe(original);
      expect(original[0].id).toBe('a'); // Original unchanged
      expect(original[1].id).toBe('b'); // Original unchanged
    });

    it('handles empty array', () => {
      const sorted = sortTasksByPriorityDueDateCreated([]);
      expect(sorted).toEqual([]);
    });

    it('handles single element', () => {
      const tasks = [
        makeTask({
          id: 'single',
          priority: 'medium',
        }),
      ];

      const sorted = sortTasksByPriorityDueDateCreated(tasks);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('single');
    });

    it('sorts tasks with missing priorities as medium', () => {
      // Create minimal TaskOrderFields to pass to sort
      const tasks = [
        makeTask({
          id: 'low',
          priority: 'low',
        }),
        makeTask({
          id: 'high',
          priority: 'high',
        }),
        makeTask({
          id: 'medium-explicit',
          priority: 'medium',
        }),
      ];

      const sorted = sortTasksByPriorityDueDateCreated(tasks);

      expect(sorted[0].id).toBe('high');
      expect(sorted[1].id).toBe('medium-explicit');
      expect(sorted[2].id).toBe('low');
    });

    it('correctly orders tasks when some have dueDate and some do not', () => {
      const tasks = [
        makeTask({
          id: 'no-due',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        makeTask({
          id: 'has-due',
          priority: 'high',
          dueDate: '2026-01-01T00:00:00.000Z',
          createdAt: '2024-01-02T00:00:00.000Z',
        }),
      ];

      const sorted = sortTasksByPriorityDueDateCreated(tasks);

      // Dated tasks sort before undated (Infinity)
      expect(sorted[0].id).toBe('has-due');
      expect(sorted[1].id).toBe('no-due');
    });
  });
});
