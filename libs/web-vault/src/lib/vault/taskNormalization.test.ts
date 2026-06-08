import { normalizeTasks } from './taskNormalization';

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(() => 'generated-id'),
}));

describe('normalizeTasks', () => {
  describe('empty and null inputs', () => {
    it('should return empty array and no change for null', () => {
      const result = normalizeTasks(null);
      expect(result).toEqual({ value: [], changed: false });
    });

    it('should return empty array and no change for undefined', () => {
      const result = normalizeTasks(undefined);
      expect(result).toEqual({ value: [], changed: false });
    });

    it('should return empty array and mark changed for non-array objects', () => {
      expect(normalizeTasks({})).toEqual({ value: [], changed: true });
      expect(normalizeTasks('string')).toEqual({ value: [], changed: true });
      expect(normalizeTasks(42)).toEqual({ value: [], changed: true });
    });

    it('should return empty array with no change for empty array', () => {
      const result = normalizeTasks([]);
      expect(result).toEqual({ value: [], changed: false });
    });
  });

  describe('legacy todo to task migration', () => {
    it('should migrate legacy { id, todo } record to Task', () => {
      const result = normalizeTasks([{ id: 'legacy-1', todo: 'Buy milk' }]);

      expect(result.value).toHaveLength(1);
      const task = result.value[0];
      expect(task.id).toBe('legacy-1');
      expect(task.title).toBe('Buy milk');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.context).toBe('personal');
      expect(task.archived).toBe(false);
      expect(task.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(task.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.changed).toBe(true);
    });

    it('should generate id for legacy record missing id', () => {
      const result = normalizeTasks([{ todo: 'Buy milk' }]);

      expect(result.value).toHaveLength(1);
      const task = result.value[0];
      expect(task.id).toBe('generated-id');
      expect(task.title).toBe('Buy milk');
      expect(result.changed).toBe(true);
    });

    it('should trim legacy todo text', () => {
      const result = normalizeTasks([{ id: 'x', todo: '  Trimmed Task  ' }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].title).toBe('Trimmed Task');
      expect(result.changed).toBe(true);
    });

    it('should skip legacy record with empty todo', () => {
      const result = normalizeTasks([{ id: 'x', todo: '   ' }]);

      expect(result.value).toHaveLength(0);
      expect(result.changed).toBe(true);
    });
  });

  describe('invalid items filtering', () => {
    it('should skip null and non-object items', () => {
      const result = normalizeTasks([null, 1, 'string']);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should skip arrays inside the input', () => {
      const result = normalizeTasks([[1, 2, 3]]);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should skip items missing required title field', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          status: 'pending',
          priority: 'medium',
          context: 'personal',
          archived: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should skip items with empty title', () => {
      const validBase = {
        id: 'a',
        title: '',
        status: 'pending' as const,
        priority: 'medium' as const,
        context: 'personal' as const,
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = normalizeTasks([validBase]);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should skip items with only whitespace title', () => {
      const validBase = {
        id: 'a',
        title: '   ',
        status: 'pending' as const,
        priority: 'medium' as const,
        context: 'personal' as const,
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = normalizeTasks([validBase]);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });
  });

  describe('required field validation', () => {
    const validTask = {
      id: 'task-1',
      title: 'Buy groceries',
      status: 'pending' as const,
      priority: 'medium' as const,
      context: 'personal' as const,
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should reject invalid status', () => {
      const result = normalizeTasks([{ ...validTask, status: 'INVALID' }]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should accept all valid statuses', () => {
      const statuses = [
        'pending',
        'in_progress',
        'done',
        'cancelled',
        'blocked',
      ] as const;

      statuses.forEach((status) => {
        const result = normalizeTasks([{ ...validTask, status }]);
        expect(result.value).toHaveLength(1);
        expect(result.value[0].status).toBe(status);
        expect(result.changed).toBe(false);
      });
    });

    it('should reject invalid priority', () => {
      const result = normalizeTasks([{ ...validTask, priority: 'INVALID' }]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should accept all valid priorities', () => {
      const priorities = ['low', 'medium', 'high'] as const;

      priorities.forEach((priority) => {
        const result = normalizeTasks([{ ...validTask, priority }]);
        expect(result.value).toHaveLength(1);
        expect(result.value[0].priority).toBe(priority);
        expect(result.changed).toBe(false);
      });
    });

    it('should reject invalid context', () => {
      const result = normalizeTasks([{ ...validTask, context: 'INVALID' }]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should accept all valid contexts', () => {
      const contexts = ['personal', 'work'] as const;

      contexts.forEach((context) => {
        const result = normalizeTasks([{ ...validTask, context }]);
        expect(result.value).toHaveLength(1);
        expect(result.value[0].context).toBe(context);
        expect(result.changed).toBe(false);
      });
    });

    it('should reject non-boolean archived field', () => {
      const result = normalizeTasks([{ ...validTask, archived: 'false' }]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should reject non-ISO8601 createdAt', () => {
      const result = normalizeTasks([
        { ...validTask, createdAt: 'not-a-date' },
      ]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should reject non-ISO8601 updatedAt', () => {
      const result = normalizeTasks([
        { ...validTask, updatedAt: 'not-a-date' },
      ]);

      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });
  });

  describe('valid task processing', () => {
    const validTask = {
      id: 'task-1',
      title: 'Buy groceries',
      status: 'pending' as const,
      priority: 'medium' as const,
      context: 'personal' as const,
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should keep valid task without marking changed', () => {
      const result = normalizeTasks([validTask]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(validTask);
      expect(result.changed).toBe(false);
    });

    it('should trim id with whitespace', () => {
      const result = normalizeTasks([{ ...validTask, id: '  task-1  ' }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe('task-1');
      expect(result.changed).toBe(true);
    });

    it('should trim title with whitespace', () => {
      const result = normalizeTasks([
        { ...validTask, title: '  Buy groceries  ' },
      ]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].title).toBe('Buy groceries');
      expect(result.changed).toBe(true);
    });

    it('should generate id if missing', () => {
      const result = normalizeTasks([{ ...validTask, id: undefined as any }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe('generated-id');
      expect(result.changed).toBe(true);
    });
  });

  describe('optional fields', () => {
    const validTask = {
      id: 'task-1',
      title: 'Buy groceries',
      status: 'pending' as const,
      priority: 'medium' as const,
      context: 'personal' as const,
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should include description when present', () => {
      const result = normalizeTasks([
        { ...validTask, description: 'Buy vegetables and fruits' },
      ]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].description).toBe('Buy vegetables and fruits');
      expect(result.changed).toBe(false);
    });

    it('should trim description with whitespace', () => {
      const result = normalizeTasks([
        { ...validTask, description: '  Trimmed description  ' },
      ]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].description).toBe('Trimmed description');
      expect(result.changed).toBe(true);
    });

    it('should skip description if empty after trim', () => {
      const result = normalizeTasks([{ ...validTask, description: '   ' }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].description).toBeUndefined();
      expect(result.changed).toBe(true);
    });

    it('should include dueDate when ISO8601 format', () => {
      const result = normalizeTasks([
        { ...validTask, dueDate: '2024-06-01T00:00:00.000Z' },
      ]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].dueDate).toBe('2024-06-01T00:00:00.000Z');
      expect(result.changed).toBe(false);
    });

    it('should skip dueDate if not ISO8601 format', () => {
      const result = normalizeTasks([{ ...validTask, dueDate: 'not-a-date' }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].dueDate).toBeUndefined();
      expect(result.changed).toBe(true);
    });

    it('should include estimatedMinutes when number', () => {
      const result = normalizeTasks([{ ...validTask, estimatedMinutes: 30 }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].estimatedMinutes).toBe(30);
      expect(result.changed).toBe(false);
    });

    it('should skip estimatedMinutes if not number', () => {
      const result = normalizeTasks([{ ...validTask, estimatedMinutes: '30' }]);

      expect(result.value).toHaveLength(1);
      expect(result.value[0].estimatedMinutes).toBeUndefined();
      expect(result.changed).toBe(true);
    });

    it('should handle all optional fields together', () => {
      const result = normalizeTasks([
        {
          ...validTask,
          description: 'Complete description',
          dueDate: '2024-06-15T10:30:00.000Z',
          estimatedMinutes: 45,
        },
      ]);

      expect(result.value).toHaveLength(1);
      const task = result.value[0];
      expect(task.description).toBe('Complete description');
      expect(task.dueDate).toBe('2024-06-15T10:30:00.000Z');
      expect(task.estimatedMinutes).toBe(45);
      expect(result.changed).toBe(false);
    });
  });

  describe('mixed valid and invalid items', () => {
    const validTask = {
      id: 'task-1',
      title: 'Valid task',
      status: 'pending' as const,
      priority: 'medium' as const,
      context: 'personal' as const,
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should process mixed valid and invalid items, skipping invalid', () => {
      const result = normalizeTasks([
        validTask,
        null,
        { id: 'bad', status: 'INVALID' },
        { id: 'task-2', todo: 'Legacy task' },
      ]);

      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toEqual(validTask);
      expect(result.value[1].title).toBe('Legacy task');
      expect(result.changed).toBe(true);
    });

    it('should mark changed when mix contains at least one invalid item', () => {
      const result = normalizeTasks([
        validTask,
        { ...validTask, id: 'task-2' },
      ]);

      expect(result.value).toHaveLength(2);
      expect(result.changed).toBe(false);
    });
  });
});
