import { randomId } from '@myorganizer/core';

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(() => 'generated-id'),
}));

import { normalizeTasks, migrateFromTodos } from './taskNormalization';

describe('normalizeTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-08T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('null and non-array inputs', () => {
    it('should return empty array with changed=false for null', () => {
      expect(normalizeTasks(null)).toEqual({ value: [], changed: false });
    });

    it('should return empty array with changed=true for non-null, non-array', () => {
      expect(normalizeTasks({})).toEqual({ value: [], changed: true });
      expect(normalizeTasks('string')).toEqual({ value: [], changed: true });
      expect(normalizeTasks(42)).toEqual({ value: [], changed: true });
    });
  });

  describe('filtering invalid items', () => {
    it('should filter out null, number, and empty object items', () => {
      const result = normalizeTasks([null, 42, {}]);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should filter out items with empty or whitespace-only title', () => {
      const result = normalizeTasks([
        { title: '' },
        { title: '   ' },
        { title: '\t' },
      ]);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should keep items with valid trimmed title', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: '  Valid  ',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].title).toBe('Valid');
    });
  });

  describe('priority normalization', () => {
    it('should keep valid priority (high, medium, low)', () => {
      const validPriorities = ['high', 'medium', 'low'] as const;
      for (const priority of validPriorities) {
        const result = normalizeTasks([
          {
            id: 'a',
            title: 'Task',
            priority,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ]);
        expect(result.value[0].priority).toBe(priority);
      }
    });

    it('should coerce invalid priority to medium', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'invalid' as any,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value[0].priority).toBe('medium');
      expect(result.changed).toBe(true);
    });

    it('should coerce missing priority to medium', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value[0].priority).toBe('medium');
      expect(result.changed).toBe(true);
    });
  });

  describe('id generation', () => {
    it('should keep valid id', () => {
      const result = normalizeTasks([
        {
          id: 'existing-id',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value[0].id).toBe('existing-id');
      expect(result.changed).toBe(false);
    });

    it('should generate id when missing', () => {
      const result = normalizeTasks([
        {
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value[0].id).toBe('generated-id');
      expect(result.changed).toBe(true);
      expect(randomId).toHaveBeenCalled();
    });

    it('should trim whitespace from id', () => {
      const result = normalizeTasks([
        {
          id: '  trimmed-id  ',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(result.value[0].id).toBe('trimmed-id');
      expect(result.changed).toBe(true);
    });

    it('should trim id and mark changed', () => {
      const result = normalizeTasks([
        {
          id: '   trimmed-id   ',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
      // toTrimmedString returns trimmed value
      expect(result.value[0].id).toBe('trimmed-id');
      // id !== raw['id'] because '   trimmed-id   ' !== 'trimmed-id'
      expect(result.changed).toBe(true);
    });
  });

  describe('date handling', () => {
    it('should keep valid ISO createdAt', () => {
      const createdAt = '2024-01-01T00:00:00.000Z';
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
          createdAt,
        },
      ]);
      expect(result.value[0].createdAt).toBe(createdAt);
      expect(result.changed).toBe(false);
    });

    it('should replace invalid createdAt with current timestamp', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
          createdAt: 'invalid-date',
        },
      ]);

      expect(result.value[0].createdAt).toBe('2024-06-08T12:00:00.000Z');
      // changed is NOT set for createdAt replacement
      expect(result.changed).toBe(false);
    });

    it('should replace missing createdAt with current timestamp', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
        },
      ]);

      expect(result.value[0].createdAt).toBe('2024-06-08T12:00:00.000Z');
      // changed is NOT set for createdAt replacement
      expect(result.changed).toBe(false);
    });

    it('should omit dueDate if invalid or empty', () => {
      const result1 = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
          dueDate: 'invalid-date',
        },
      ]);
      expect(result1.value[0]).not.toHaveProperty('dueDate');

      const result2 = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
          dueDate: '   ',
        },
      ]);
      expect(result2.value[0]).not.toHaveProperty('dueDate');
    });

    it('should keep valid dueDate', () => {
      const dueDate = '2024-12-31T00:00:00.000Z';
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
          dueDate,
        },
      ]);
      expect(result.value[0].dueDate).toBe(dueDate);
      expect(result.changed).toBe(false);
    });
  });

  describe('complete task normalization', () => {
    it('should return unchanged result for already-normalized valid task', () => {
      const task = {
        id: 'task-1',
        title: 'Valid Task',
        priority: 'high' as const,
        createdAt: '2024-01-01T00:00:00.000Z',
        dueDate: '2024-12-31T00:00:00.000Z',
      };
      const result = normalizeTasks([task]);
      expect(result.value[0]).toEqual(task);
      expect(result.changed).toBe(false);
    });

    it('should normalize multiple tasks in array', () => {
      const result = normalizeTasks([
        {
          id: 'a',
          title: 'Task 1',
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'b',
          title: 'Task 2',
          priority: 'medium',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
        null,
        {
          id: 'c',
          title: 'Task 3',
          priority: 'invalid',
          createdAt: '2024-01-03T00:00:00.000Z',
        },
      ]);
      expect(result.value).toHaveLength(3);
      expect(result.changed).toBe(true);
      expect(result.value[2].priority).toBe('medium');
    });
  });
});

describe('migrateFromTodos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-08T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should convert todos to tasks', () => {
    const todos = [
      { id: 'todo1', todo: 'Buy milk' },
      { id: 'todo2', todo: 'Call mom' },
    ];
    const result = migrateFromTodos(todos);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'todo1',
      title: 'Buy milk',
      priority: 'medium',
      createdAt: '2024-06-08T12:00:00.000Z',
    });
    expect(result[1]).toEqual({
      id: 'todo2',
      title: 'Call mom',
      priority: 'medium',
      createdAt: '2024-06-08T12:00:00.000Z',
    });
  });

  it('should use same createdAt timestamp for all migrated tasks', () => {
    const todos = [
      { id: 'todo1', todo: 'Task 1' },
      { id: 'todo2', todo: 'Task 2' },
    ];
    const result = migrateFromTodos(todos);

    expect(result[0].createdAt).toBe(result[1].createdAt);
  });

  it('should handle empty array', () => {
    const result = migrateFromTodos([]);
    expect(result).toEqual([]);
  });

  it('should set all tasks to medium priority', () => {
    const todos = [
      { id: 'todo1', todo: 'Task 1' },
      { id: 'todo2', todo: 'Task 2' },
    ];
    const result = migrateFromTodos(todos);

    expect(result.every((task) => task.priority === 'medium')).toBe(true);
  });
});
