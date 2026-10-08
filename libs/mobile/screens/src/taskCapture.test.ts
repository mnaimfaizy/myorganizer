import type { Task } from '@myorganizer/vault-core/portable';
import {
  captureLanded,
  draftAfterLanding,
  EMPTY_TASK_DRAFT,
  nextUnsentCapture,
  sameTaskDraft,
  tasksToSend,
  taskToCapture,
  type TaskDraft,
  type UnsentCapture,
} from './taskCapture';

const NOW = new Date(2026, 9, 8, 23, 30);

const draftOf = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  ...EMPTY_TASK_DRAFT,
  title: 'Buy milk',
  ...overrides,
});

const ids = (...values: string[]): (() => string) => {
  const queue = [...values];
  return () => queue.shift() ?? 'exhausted';
};

const capture = (
  draft: TaskDraft,
  unsent: UnsentCapture | null = null,
  id = ids('task-1'),
): Task | null => taskToCapture(draft, unsent, { id, now: NOW });

const unsentOf = (draft: TaskDraft, id = 'task-1'): UnsentCapture => ({
  task: capture(draft, null, ids(id)) as Task,
  draft,
  carried: [],
});

describe('taskCapture', () => {
  describe('taskToCapture', () => {
    it('should capture nothing for a blank title', () => {
      expect(capture(draftOf({ title: '   ' }))).toBeNull();
    });

    it('should capture a pending, medium, undated Task from a title alone', () => {
      expect(capture(draftOf({ title: '  Buy milk ' }))).toEqual({
        id: 'task-1',
        title: 'Buy milk',
        status: 'pending',
        priority: 'medium',
        archived: false,
        createdAt: NOW.toISOString(),
      });
    });

    it('should carry the chips onto the Task', () => {
      const task = capture(
        draftOf({ dueChoice: 'tomorrow', priority: 'high', context: 'work' }),
      );
      expect(task).toMatchObject({
        dueDate: '2026-10-09',
        priority: 'high',
        context: 'work',
      });
    });

    it('should read Today in local time, and a picked date as picked', () => {
      expect(capture(draftOf({ dueChoice: 'today' }))?.dueDate).toBe(
        '2026-10-08',
      );
      expect(
        capture(draftOf({ dueChoice: 'custom', customDate: '2026-12-01' }))
          ?.dueDate,
      ).toBe('2026-12-01');
    });

    it('should send the same Task again when the draft that did not land is unchanged', () => {
      const draft = draftOf({ priority: 'high' });
      const unsent = unsentOf(draft);
      const again = taskToCapture({ ...draft, title: 'Buy milk  ' }, unsent, {
        id: ids('task-2'),
        now: new Date(2026, 9, 9),
      });
      expect(again).toBe(unsent.task);
    });

    it('should make a new Task when the draft was changed after it did not land', () => {
      const unsent = unsentOf(draftOf());
      const next = capture(
        draftOf({ title: 'Buy oat milk' }),
        unsent,
        ids('task-2'),
      );
      expect(next?.id).toBe('task-2');
      expect(next?.title).toBe('Buy oat milk');
    });

    it('should make a new Task when only a chip was changed', () => {
      const unsent = unsentOf(draftOf());
      expect(
        capture(draftOf({ context: 'personal' }), unsent, ids('task-2'))?.id,
      ).toBe('task-2');
    });
  });

  describe('sameTaskDraft', () => {
    it('should ignore a custom date that is not the choice', () => {
      expect(
        sameTaskDraft(
          draftOf({ dueChoice: 'today', customDate: '2026-12-01' }),
          draftOf({ dueChoice: 'today', customDate: null }),
        ),
      ).toBe(true);
    });

    it('should tell two picked dates apart', () => {
      expect(
        sameTaskDraft(
          draftOf({ dueChoice: 'custom', customDate: '2026-12-01' }),
          draftOf({ dueChoice: 'custom', customDate: '2026-12-02' }),
        ),
      ).toBe(false);
    });
  });

  describe('captureLanded', () => {
    const unsent = unsentOf(draftOf());

    it('should not have landed while the push is in flight, though the row shows', () => {
      expect(captureLanded(unsent, [unsent.task], true)).toBe(false);
    });

    it('should not have landed once a refused push took the row away', () => {
      expect(captureLanded(unsent, [{ id: 'other' }], false)).toBe(false);
      expect(captureLanded(unsent, undefined, false)).toBe(false);
    });

    it('should have landed when the Task is in the confirmed copy', () => {
      expect(captureLanded(unsent, [{ id: 'other' }, unsent.task], false)).toBe(
        true,
      );
    });

    it('should not land a capture that was never made', () => {
      expect(captureLanded(null, [{ id: 'task-1' }], false)).toBe(false);
    });
  });

  describe('draftAfterLanding', () => {
    it('should clear the draft that was sent, chips and all', () => {
      const draft = draftOf({ dueChoice: 'tomorrow', priority: 'high' });
      expect(draftAfterLanding(draft, unsentOf(draft))).toEqual(
        EMPTY_TASK_DRAFT,
      );
    });

    it('should keep what was typed over the draft while it was being sent', () => {
      const typed = draftOf({ title: 'Call the plumber' });
      expect(draftAfterLanding(typed, unsentOf(draftOf()))).toBe(typed);
    });
  });

  // #1007: a second Save while the first add is still held.
  describe('A second Save after an add that did not land', () => {
    it('should not make a second Task from the same draft', () => {
      const draft = draftOf();
      const first = capture(draft) as Task;
      const second = capture(
        draft,
        { task: first, draft, carried: [] },
        ids('task-2'),
      );
      expect(second?.id).toBe(first.id);
    });

    it('should send the first Task again with a second one written over it', () => {
      const first = unsentOf(draftOf());
      const typed = draftOf({ title: 'Call the plumber' });
      const second = capture(typed, first, ids('task-2')) as Task;
      const sending = nextUnsentCapture(second, typed, first);
      expect(second.id).toBe('task-2');
      expect(tasksToSend(sending).map((task) => task.title)).toEqual([
        'Buy milk',
        'Call the plumber',
      ]);
    });

    it('should go on carrying every Task that has not landed', () => {
      const first = unsentOf(draftOf());
      const secondDraft = draftOf({ title: 'Call the plumber' });
      const second = nextUnsentCapture(
        capture(secondDraft, first, ids('task-2')) as Task,
        secondDraft,
        first,
      );
      const thirdDraft = draftOf({ title: 'Post the letter' });
      const third = nextUnsentCapture(
        capture(thirdDraft, second, ids('task-3')) as Task,
        thirdDraft,
        second,
      );
      expect(tasksToSend(third).map((task) => task.id)).toEqual([
        'task-1',
        'task-2',
        'task-3',
      ]);
    });

    it('should carry the same Tasks when the same draft is saved again', () => {
      const first = unsentOf(draftOf());
      const typed = draftOf({ title: 'Call the plumber' });
      const second = nextUnsentCapture(
        capture(typed, first, ids('task-2')) as Task,
        typed,
        first,
      );
      const again = nextUnsentCapture(
        capture(typed, second, ids('task-3')) as Task,
        typed,
        second,
      );
      expect(tasksToSend(again).map((task) => task.id)).toEqual([
        'task-1',
        'task-2',
      ]);
    });

    it('should send one Task alone when nothing before it is unsent', () => {
      const draft = draftOf();
      const only = nextUnsentCapture(capture(draft) as Task, draft, null);
      expect(tasksToSend(only).map((task) => task.id)).toEqual(['task-1']);
    });

    it('should keep the changed draft once the first Task lands by a retry', () => {
      const first = unsentOf(draftOf());
      const typed = draftOf({ title: 'Call the plumber' });
      expect(captureLanded(first, [first.task], false)).toBe(true);
      expect(draftAfterLanding(typed, first)).toBe(typed);
      // Released, so the next Save is a Task of its own.
      expect(capture(typed, null, ids('task-2'))?.id).toBe('task-2');
    });
  });
});
