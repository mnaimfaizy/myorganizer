import { isClosedTaskStatus, transitionTaskStatus } from './taskTransition';
import type { Task, TaskStatus } from './task';

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

describe('isClosedTaskStatus', () => {
  it('returns true for done', () => {
    expect(isClosedTaskStatus('done')).toBe(true);
  });

  it('returns true for cancelled', () => {
    expect(isClosedTaskStatus('cancelled')).toBe(true);
  });

  it('returns false for pending', () => {
    expect(isClosedTaskStatus('pending')).toBe(false);
  });

  it('returns false for in_progress', () => {
    expect(isClosedTaskStatus('in_progress')).toBe(false);
  });

  it('returns false for blocked', () => {
    expect(isClosedTaskStatus('blocked')).toBe(false);
  });
});

describe('transitionTaskStatus', () => {
  describe('entering closed from open status', () => {
    const openStatuses: TaskStatus[] = ['pending', 'in_progress', 'blocked'];
    const closedStatuses: TaskStatus[] = ['done', 'cancelled'];
    const now = '2024-06-15T12:00:00.000Z';

    openStatuses.forEach((openStatus) => {
      closedStatuses.forEach((closedStatus) => {
        it(`sets closedAt when transitioning from ${openStatus} to ${closedStatus}`, () => {
          const task = makeTask({ status: openStatus });
          const result = transitionTaskStatus(task, closedStatus, now);

          expect(result.status).toBe(closedStatus);
          expect(result.closedAt).toBe(now);
          expect(result.updatedAt).toBe(now);
        });
      });
    });
  });

  describe('staying closed', () => {
    const now = '2024-06-15T12:00:00.000Z';
    const earlierClosedAt = '2024-06-14T10:00:00.000Z';

    it('keeps existing closedAt when transitioning from done to cancelled', () => {
      const task = makeTask({
        status: 'done',
        closedAt: earlierClosedAt,
      });
      const result = transitionTaskStatus(task, 'cancelled', now);

      expect(result.status).toBe('cancelled');
      expect(result.closedAt).toBe(earlierClosedAt);
      expect(result.updatedAt).toBe(now);
    });

    it('keeps existing closedAt when transitioning from cancelled to done', () => {
      const task = makeTask({
        status: 'cancelled',
        closedAt: earlierClosedAt,
      });
      const result = transitionTaskStatus(task, 'done', now);

      expect(result.status).toBe('done');
      expect(result.closedAt).toBe(earlierClosedAt);
      expect(result.updatedAt).toBe(now);
    });

    it('keeps existing closedAt when staying in done', () => {
      const task = makeTask({
        status: 'done',
        closedAt: earlierClosedAt,
      });
      const result = transitionTaskStatus(task, 'done', now);

      expect(result.status).toBe('done');
      expect(result.closedAt).toBe(earlierClosedAt);
      expect(result.updatedAt).toBe(now);
    });

    it('keeps undefined closedAt when transitioning between closed statuses with no prior closedAt', () => {
      const task = makeTask({
        status: 'done',
      });
      const result = transitionTaskStatus(task, 'cancelled', now);

      expect(result.status).toBe('cancelled');
      expect(result).not.toHaveProperty('closedAt');
      expect(result.updatedAt).toBe(now);
    });
  });

  describe('reopening from closed status', () => {
    const openStatuses: TaskStatus[] = ['pending', 'in_progress', 'blocked'];
    const now = '2024-06-15T12:00:00.000Z';
    const priorClosedAt = '2024-06-14T10:00:00.000Z';

    openStatuses.forEach((openStatus) => {
      it(`clears closedAt when transitioning from done to ${openStatus}`, () => {
        const task = makeTask({
          status: 'done',
          closedAt: priorClosedAt,
        });
        const result = transitionTaskStatus(task, openStatus, now);

        expect(result.status).toBe(openStatus);
        expect(result).not.toHaveProperty('closedAt');
        expect(result.updatedAt).toBe(now);
      });
    });

    it('clears closedAt when transitioning from cancelled to pending', () => {
      const task = makeTask({
        status: 'cancelled',
        closedAt: priorClosedAt,
      });
      const result = transitionTaskStatus(task, 'pending', now);

      expect(result.status).toBe('pending');
      expect(result).not.toHaveProperty('closedAt');
      expect(result.updatedAt).toBe(now);
    });
  });

  describe('updatedAt is always set', () => {
    const now = '2024-06-15T12:00:00.000Z';

    it('sets updatedAt when transitioning to a different status', () => {
      const task = makeTask({ status: 'pending' });
      const result = transitionTaskStatus(task, 'in_progress', now);

      expect(result.updatedAt).toBe(now);
    });

    it('sets updatedAt even when transitioning to the same status', () => {
      const task = makeTask({ status: 'pending' });
      const result = transitionTaskStatus(task, 'pending', now);

      expect(result.updatedAt).toBe(now);
    });

    it('sets updatedAt when transitioning between closed statuses', () => {
      const task = makeTask({ status: 'done' });
      const result = transitionTaskStatus(task, 'cancelled', now);

      expect(result.updatedAt).toBe(now);
    });
  });

  describe('purity and field preservation', () => {
    const now = '2024-06-15T12:00:00.000Z';

    it('does not mutate the input task', () => {
      const task = makeTask({
        status: 'pending',
        title: 'Original title',
        priority: 'high',
      });
      const taskBefore = JSON.parse(JSON.stringify(task));

      transitionTaskStatus(task, 'done', now);

      expect(task).toEqual(taskBefore);
    });

    it('carries over all fields except status, closedAt, and updatedAt', () => {
      const task = makeTask({
        id: 'task-123',
        title: 'My task',
        description: 'Task description',
        priority: 'high',
        context: 'work',
        dueDate: '2024-12-31T00:00:00.000Z',
        estimatedMinutes: 120,
        archived: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        status: 'pending',
      });

      const result = transitionTaskStatus(task, 'done', now);

      expect(result.id).toBe('task-123');
      expect(result.title).toBe('My task');
      expect(result.description).toBe('Task description');
      expect(result.priority).toBe('high');
      expect(result.context).toBe('work');
      expect(result.dueDate).toBe('2024-12-31T00:00:00.000Z');
      expect(result.estimatedMinutes).toBe(120);
      expect(result.archived).toBe(true);
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('preserves optional fields when present during a transition', () => {
      const task = makeTask({
        status: 'pending',
        description: 'Has description',
        dueDate: '2024-12-31T00:00:00.000Z',
      });

      const result = transitionTaskStatus(task, 'in_progress', now);

      expect(result.description).toBe('Has description');
      expect(result.dueDate).toBe('2024-12-31T00:00:00.000Z');
    });

    it('preserves absence of optional fields during a transition', () => {
      const task = makeTask({
        status: 'pending',
      });

      const result = transitionTaskStatus(task, 'in_progress', now);

      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('context');
      expect(result).not.toHaveProperty('dueDate');
      expect(result).not.toHaveProperty('estimatedMinutes');
    });
  });
});
