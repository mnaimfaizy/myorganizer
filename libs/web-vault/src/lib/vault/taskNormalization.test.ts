import { normalizeTasks } from './taskNormalization';

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
});
