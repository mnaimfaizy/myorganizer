import { normalizeTasks } from './taskNormalization';

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn().mockReturnValue('generated-id'),
}));

describe('taskNormalization', () => {
  describe('normalizeTasks', () => {
    // --- Input validation and array coercion ---

    it('returns empty array and changed=false for null input', () => {
      const result = normalizeTasks(null);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(false);
    });

    it('returns empty array and changed=true for non-null non-array input', () => {
      const result = normalizeTasks({});
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('returns empty array and changed=true for undefined input', () => {
      const result = normalizeTasks(undefined);
      expect(result.value).toEqual([]);
      expect(result.changed).toBe(true);
    });

    // --- Core field normalization with changed flag ---

    it('preserves fully valid task without changes', () => {
      const createdAtISO = '2024-01-01T00:00:00.000Z';
      const input = [
        {
          id: '1',
          title: 'Task 1',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: createdAtISO,
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).toEqual({
        id: '1',
        title: 'Task 1',
        status: 'pending',
        archived: false,
        priority: 'medium',
        createdAt: createdAtISO,
      });
      expect(result.changed).toBe(false);
    });

    it('generates id when missing and marks changed=true', () => {
      const input = [
        {
          title: 'No ID Task',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].id).toBe('generated-id');
      expect(result.changed).toBe(true);
    });

    it('defaults missing priority to medium and marks changed=true', () => {
      const input = [
        {
          id: '1',
          title: 'No Priority',
          status: 'pending',
          archived: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].priority).toBe('medium');
      expect(result.changed).toBe(true);
    });

    it('defaults invalid priority to medium and marks changed=true', () => {
      const input = [
        {
          id: '1',
          title: 'Invalid Priority',
          status: 'pending',
          archived: false,
          priority: 'urgent',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].priority).toBe('medium');
      expect(result.changed).toBe(true);
    });

    it('preserves valid priority value without marking changed', () => {
      const input = [
        {
          id: '1',
          title: 'High Priority',
          status: 'pending',
          archived: false,
          priority: 'high',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].priority).toBe('high');
      expect(result.changed).toBe(false);
    });

    it('preserves low priority without marking changed', () => {
      const input = [
        {
          id: '1',
          title: 'Low Priority',
          status: 'pending',
          archived: false,
          priority: 'low',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].priority).toBe('low');
      expect(result.changed).toBe(false);
    });

    it('generates createdAt when missing and marks changed=true', () => {
      const beforeTime = new Date();
      const input = [
        {
          id: '1',
          title: 'No CreatedAt',
          status: 'pending',
          archived: false,
          priority: 'medium',
        },
      ];
      const result = normalizeTasks(input);
      const afterTime = new Date();

      expect(result.value[0].createdAt).toBeTruthy();
      expect(typeof result.value[0].createdAt).toBe('string');
      const createdAtDate = new Date(result.value[0].createdAt);
      expect(createdAtDate.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime() - 1000,
      );
      expect(createdAtDate.getTime()).toBeLessThanOrEqual(
        afterTime.getTime() + 1000,
      );
      expect(result.changed).toBe(true);
    });

    it('preserves provided createdAt without marking changed', () => {
      const createdAtISO = '2024-06-01T12:00:00.000Z';
      const input = [
        {
          id: '1',
          title: 'With CreatedAt',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: createdAtISO,
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].createdAt).toBe(createdAtISO);
      expect(result.changed).toBe(false);
    });

    it('defaults invalid status to pending and marks changed=true', () => {
      const input = [
        {
          id: '1',
          title: 'Invalid Status',
          status: 'invalid',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].status).toBe('pending');
      expect(result.changed).toBe(true);
    });

    it('preserves all valid task statuses without marking changed', () => {
      const statuses = [
        'pending',
        'in_progress',
        'done',
        'cancelled',
        'blocked',
      ];
      const input = statuses.map((status, idx) => ({
        id: String(idx),
        title: `Task ${idx}`,
        status,
        archived: false,
        priority: 'medium',
        createdAt: '2024-01-01T00:00:00.000Z',
      })) as Parameters<typeof normalizeTasks>[0];

      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(5);
      statuses.forEach((status, idx) => {
        expect(result.value[idx].status).toBe(status);
      });
      expect(result.changed).toBe(false);
    });

    it('defaults missing archived to false and marks changed=true', () => {
      const input = [
        {
          id: '1',
          title: 'No Archived',
          status: 'pending',
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].archived).toBe(false);
      expect(result.changed).toBe(true);
    });

    it('defaults non-boolean archived to false and marks changed=true', () => {
      const input = [
        {
          id: '1',
          title: 'Non-Boolean Archived',
          status: 'pending',
          archived: 'yes',
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].archived).toBe(false);
      expect(result.changed).toBe(true);
    });

    it('preserves boolean archived=true without marking changed', () => {
      const input = [
        {
          id: '1',
          title: 'Archived Task',
          status: 'pending',
          archived: true,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].archived).toBe(true);
      expect(result.changed).toBe(false);
    });

    it('trims title and marks changed=true when whitespace present', () => {
      const input = [
        {
          id: '1',
          title: '  Task with Whitespace  ',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].title).toBe('Task with Whitespace');
      expect(result.changed).toBe(true);
    });

    // --- Optional fields: description, context, dueDate, estimatedMinutes, updatedAt ---

    it('includes description when provided and non-empty', () => {
      const input = [
        {
          id: '1',
          title: 'With Description',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          description: 'This is a description',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].description).toBe('This is a description');
      expect(result.changed).toBe(false);
    });

    it('omits description when not provided', () => {
      const input = [
        {
          id: '1',
          title: 'No Description',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('description');
      expect(result.changed).toBe(false);
    });

    it('omits description when empty string', () => {
      const input = [
        {
          id: '1',
          title: 'Empty Description',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          description: '',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('description');
      expect(result.changed).toBe(false);
    });

    it('omits description when whitespace-only', () => {
      const input = [
        {
          id: '1',
          title: 'Whitespace Description',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          description: '   ',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('description');
      expect(result.changed).toBe(false);
    });

    it('trims description when provided', () => {
      const input = [
        {
          id: '1',
          title: 'Trim Description',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          description: '  trimmed desc  ',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].description).toBe('trimmed desc');
      expect(result.changed).toBe(false);
    });

    it('includes context when valid (personal)', () => {
      const input = [
        {
          id: '1',
          title: 'Personal Context',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          context: 'personal',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].context).toBe('personal');
      expect(result.changed).toBe(false);
    });

    it('includes context when valid (work)', () => {
      const input = [
        {
          id: '1',
          title: 'Work Context',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          context: 'work',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].context).toBe('work');
      expect(result.changed).toBe(false);
    });

    it('omits context when not provided', () => {
      const input = [
        {
          id: '1',
          title: 'No Context',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('context');
      expect(result.changed).toBe(false);
    });

    it('omits context when invalid', () => {
      const input = [
        {
          id: '1',
          title: 'Invalid Context',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          context: 'home',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('context');
      expect(result.changed).toBe(false);
    });

    it('includes dueDate when provided', () => {
      const input = [
        {
          id: '1',
          title: 'With Due Date',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          dueDate: '2024-12-31',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].dueDate).toBe('2024-12-31');
      expect(result.changed).toBe(false);
    });

    it('omits dueDate when not provided', () => {
      const input = [
        {
          id: '1',
          title: 'No Due Date',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('dueDate');
      expect(result.changed).toBe(false);
    });

    it('omits dueDate when empty string', () => {
      const input = [
        {
          id: '1',
          title: 'Empty Due Date',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          dueDate: '',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('dueDate');
      expect(result.changed).toBe(false);
    });

    it('includes estimatedMinutes when provided and > 0', () => {
      const input = [
        {
          id: '1',
          title: 'With Estimate',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          estimatedMinutes: 30,
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].estimatedMinutes).toBe(30);
      expect(result.changed).toBe(false);
    });

    it('omits estimatedMinutes when not provided', () => {
      const input = [
        {
          id: '1',
          title: 'No Estimate',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('estimatedMinutes');
      expect(result.changed).toBe(false);
    });

    it('omits estimatedMinutes when 0', () => {
      const input = [
        {
          id: '1',
          title: 'Zero Estimate',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          estimatedMinutes: 0,
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('estimatedMinutes');
      expect(result.changed).toBe(false);
    });

    it('omits estimatedMinutes when negative', () => {
      const input = [
        {
          id: '1',
          title: 'Negative Estimate',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          estimatedMinutes: -5,
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('estimatedMinutes');
      expect(result.changed).toBe(false);
    });

    it('includes updatedAt when provided', () => {
      const input = [
        {
          id: '1',
          title: 'With Updated At',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-06-01T12:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0].updatedAt).toBe('2024-06-01T12:00:00.000Z');
      expect(result.changed).toBe(false);
    });

    it('omits updatedAt when not provided', () => {
      const input = [
        {
          id: '1',
          title: 'No Updated At',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('updatedAt');
      expect(result.changed).toBe(false);
    });

    it('omits updatedAt when empty string', () => {
      const input = [
        {
          id: '1',
          title: 'Empty Updated At',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value[0]).not.toHaveProperty('updatedAt');
      expect(result.changed).toBe(false);
    });

    // --- Task filtering and multiple-task scenarios ---

    it('skips tasks with null/falsy item in array', () => {
      const input = [
        {
          id: '1',
          title: 'Task 1',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        null,
        {
          id: '2',
          title: 'Task 2',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe('1');
      expect(result.value[1].id).toBe('2');
      expect(result.changed).toBe(true);
    });

    it('skips tasks with non-object item in array', () => {
      const input = [
        {
          id: '1',
          title: 'Task 1',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        'string',
        {
          id: '2',
          title: 'Task 2',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(2);
      expect(result.changed).toBe(true);
    });

    it('skips tasks with empty string title', () => {
      const input = [
        {
          id: '1',
          title: '',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    it('skips tasks with whitespace-only title', () => {
      const input = [
        {
          id: '1',
          title: '   ',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    it('skips tasks with non-string title', () => {
      const input = [
        {
          id: '1',
          title: 123,
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    it('normalizes mixed valid and invalid tasks correctly', () => {
      const input = [
        {
          id: '1',
          title: 'Valid Task',
          status: 'pending',
          archived: false,
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        { id: '2', title: '   ' },
        {
          id: '3',
          title: 'Another Valid',
          status: 'done',
          archived: true,
          priority: 'high',
          createdAt: '2024-02-01T00:00:00.000Z',
        },
        null,
      ];
      const result = normalizeTasks(input);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe('1');
      expect(result.value[1].id).toBe('3');
      expect(result.changed).toBe(true);
    });

    it('combines multiple changed flags when any core field is modified', () => {
      const input = [
        {
          title: '  Title with spaces  ',
          status: 'invalid',
          priority: 'urgent',
          archived: 'yes',
          priority: 'urgent',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const result = normalizeTasks(input);
      // changed=true because: id generated, title trimmed, status defaulted, priority defaulted, archived defaulted
      expect(result.changed).toBe(true);
    });
  });
});
