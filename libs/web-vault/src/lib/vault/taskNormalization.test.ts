import { migrateFromTodos, normalizeTasks } from './taskNormalization';

describe('taskNormalization', () => {
  describe('normalizeTasks', () => {
    it('returns empty array for non-array input', () => {
      const result = normalizeTasks(null);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('normalizes valid tasks with all fields', () => {
      const input = [
        { id: '1', title: 'Task 1', status: 'pending', archived: false },
        { id: '2', title: 'Task 2', status: 'in_progress', archived: false },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toEqual(input);
      expect(result.changed).toBe(false);
    });

    it('generates id for tasks without id', () => {
      const input = [{ title: 'Task 1', status: 'pending', archived: false }];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBeTruthy();
      expect(result.changed).toBe(true);
    });

    it('defaults status to pending if invalid', () => {
      const input = [
        { id: '1', title: 'Task 1', status: 'invalid', archived: false },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].status).toBe('pending');
      expect(result.changed).toBe(true);
    });

    it('defaults archived to false if missing', () => {
      const input = [{ id: '1', title: 'Task 1', status: 'pending' }];
      const result = normalizeTasks(input);
      expect(result.value[0].archived).toBe(false);
      expect(result.changed).toBe(true);
    });

    it('skips tasks with empty or missing title', () => {
      const input = [
        { id: '1', title: 'Task 1', status: 'pending', archived: false },
        { id: '2', title: '   ', status: 'pending', archived: false },
        { id: '3', status: 'pending', archived: false },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(1);
      expect(result.changed).toBe(true);
    });

    it('normalizes all valid task statuses', () => {
      const input = [
        { id: '1', title: 'Pending', status: 'pending', archived: false },
        {
          id: '2',
          title: 'In Progress',
          status: 'in_progress',
          archived: false,
        },
        { id: '3', title: 'Done', status: 'done', archived: false },
        { id: '4', title: 'Cancelled', status: 'cancelled', archived: false },
        { id: '5', title: 'Blocked', status: 'blocked', archived: false },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(5);
      expect(result.changed).toBe(false);
    });
  });

  describe('migrateFromTodos', () => {
    it('returns empty array for non-array input', () => {
      expect(migrateFromTodos(null)).toEqual([]);
      expect(migrateFromTodos(undefined)).toEqual([]);
      expect(migrateFromTodos({ todo: 'not an array' })).toEqual([]);
      expect(migrateFromTodos('not an array')).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      expect(migrateFromTodos([])).toEqual([]);
    });

    it('converts string items to tasks with generated id', () => {
      const result = migrateFromTodos(['Buy milk', 'Walk dog']);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        title: 'Buy milk',
        status: 'pending',
        priority: 'medium',
        archived: false,
      });
      expect(result[0].id).toBeTruthy();
      expect(result[0].createdAt).toBeTruthy();
      expect(result[1]).toMatchObject({
        title: 'Walk dog',
        status: 'pending',
        priority: 'medium',
        archived: false,
      });
      expect(result[1].id).toBeTruthy();
    });

    it('skips whitespace-only string items', () => {
      const result = migrateFromTodos(['Valid task', '   ', '\t', '']);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid task');
    });

    it('converts objects with id and todo fields', () => {
      const result = migrateFromTodos([
        { id: 'todo-1', todo: 'First task' },
        { id: 'todo-2', todo: 'Second task' },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'todo-1',
        title: 'First task',
        status: 'pending',
        priority: 'medium',
        archived: false,
      });
      expect(result[1]).toMatchObject({
        id: 'todo-2',
        title: 'Second task',
        status: 'pending',
        priority: 'medium',
        archived: false,
      });
    });

    it('generates id when object has missing or blank id field', () => {
      const resultMissingId = migrateFromTodos([{ todo: 'Task without id' }]);
      expect(resultMissingId).toHaveLength(1);
      expect(resultMissingId[0].id).toBeTruthy();
      expect(resultMissingId[0].title).toBe('Task without id');

      const resultBlankId = migrateFromTodos([
        { id: '   ', todo: 'Task with blank id' },
      ]);
      expect(resultBlankId).toHaveLength(1);
      expect(resultBlankId[0].id).toBeTruthy();
      expect(resultBlankId[0].title).toBe('Task with blank id');
    });

    it('skips objects with empty or missing todo field', () => {
      const result = migrateFromTodos([
        { id: 'id-1', todo: 'Valid' },
        { id: 'id-2', todo: '   ' },
        { id: 'id-3' },
        { id: 'id-4', todo: '' },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid');
    });

    it('skips non-object, non-string items', () => {
      const result = migrateFromTodos([
        'Valid string',
        123,
        null,
        true,
        { todo: 'Another valid' },
        undefined,
        [],
      ] as any);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Valid string');
      expect(result[1].title).toBe('Another valid');
    });

    it('handles mixed valid and invalid items correctly', () => {
      const result = migrateFromTodos([
        'String task',
        { id: 'obj-1', todo: 'Object task' },
        null,
        '   ',
        { id: 'obj-2' },
        123,
        { todo: 'Object without id' },
      ] as any);
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('String task');
      expect(result[1]).toMatchObject({ id: 'obj-1', title: 'Object task' });
      expect(result[2].title).toBe('Object without id');
      expect(result[2].id).toBeTruthy();
    });

    it('sets all tasks to pending status and medium priority', () => {
      const result = migrateFromTodos([
        'Task 1',
        { id: 'id-1', todo: 'Task 2' },
      ]);
      expect(result).toHaveLength(2);
      result.forEach((task) => {
        expect(task.status).toBe('pending');
        expect(task.priority).toBe('medium');
      });
    });

    it('sets archived to false for all migrated tasks', () => {
      const result = migrateFromTodos([
        'Task 1',
        { id: 'id-1', todo: 'Task 2' },
      ]);
      expect(result).toHaveLength(2);
      result.forEach((task) => {
        expect(task.archived).toBe(false);
      });
    });

    it('sets createdAt to ISO string for all tasks', () => {
      const result = migrateFromTodos(['Task']);
      expect(result).toHaveLength(1);
      expect(typeof result[0].createdAt).toBe('string');
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('trims whitespace from string and todo fields', () => {
      const result = migrateFromTodos([
        '  Task with spaces  ',
        { id: 'id-1', todo: '  Trimmed task  ' },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task with spaces');
      expect(result[1].title).toBe('Trimmed task');
    });

    it('trims whitespace from id field when used', () => {
      const result = migrateFromTodos([
        { id: '  id-with-spaces  ', todo: 'Task' },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-with-spaces');
    });
  });
});
