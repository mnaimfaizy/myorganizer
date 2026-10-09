import {
  dueDateGroup,
  selectOpenTaskGroups,
  selectClosedTaskSections,
  priorityBarCount,
  localDateOnlyString,
  findVisibleTask,
  taskOnDetail,
  taskRemovalNoticePlace,
  taskRemovalPhase,
  taskStatus,
  type TaskRemoval,
} from './taskModel';

describe('taskModel', () => {
  describe('dueDateGroup', () => {
    it('returns "noDate" when dueDate is undefined', () => {
      const now = new Date('2026-01-15');
      expect(dueDateGroup(undefined, now)).toBe('noDate');
    });

    it('returns "noDate" for malformed date string', () => {
      const now = new Date('2026-01-15');
      expect(dueDateGroup('not-a-date', now)).toBe('noDate');
      expect(dueDateGroup('2026/01/15', now)).toBe('noDate');
      expect(dueDateGroup('', now)).toBe('noDate');
    });

    it('returns "overdue" for a date before today local', () => {
      const now = new Date('2026-01-15');
      expect(dueDateGroup('2026-01-14', now)).toBe('overdue');
      expect(dueDateGroup('2026-01-01', now)).toBe('overdue');
    });

    it('returns "today" for a date matching today local', () => {
      const now = new Date('2026-01-15');
      expect(dueDateGroup('2026-01-15', now)).toBe('today');
    });

    it('returns "upcoming" for a date after today local', () => {
      const now = new Date('2026-01-15');
      expect(dueDateGroup('2026-01-16', now)).toBe('upcoming');
      expect(dueDateGroup('2026-12-31', now)).toBe('upcoming');
    });

    it('respects local calendar day, not UTC, by using local time components', () => {
      // Set timezone to US Pacific (UTC-8), where a bare YYYY-MM-DD would parse
      // as UTC midnight, which would be 4pm PST the previous calendar day
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = 'America/Los_Angeles';

        // Construct a date representing 2026-01-15 in local time
        const now = new Date(2026, 0, 15); // Jan 15 in local time

        // A task due "2026-01-15" should be "today" even when parsed as UTC
        // would shift it to the previous day in Los Angeles time
        expect(dueDateGroup('2026-01-15', now)).toBe('today');

        // One day before should be "overdue"
        expect(dueDateGroup('2026-01-14', now)).toBe('overdue');

        // One day after should be "upcoming"
        expect(dueDateGroup('2026-01-16', now)).toBe('upcoming');
      } finally {
        // Assigning `undefined` would store the string "undefined"; unset instead.
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
      }
    });
  });

  describe('localDateOnlyString', () => {
    it('formats a date to YYYY-MM-DD zero-padded string in local time', () => {
      const date = new Date(2026, 0, 5); // Jan 5, 2026 in local time
      expect(localDateOnlyString(date)).toBe('2026-01-05');
    });

    it('zero-pads month and day', () => {
      const date1 = new Date(2026, 0, 1); // Jan 1
      expect(localDateOnlyString(date1)).toBe('2026-01-01');

      const date2 = new Date(2026, 11, 25); // Dec 25
      expect(localDateOnlyString(date2)).toBe('2026-12-25');
    });

    it('uses local calendar components, not UTC', () => {
      // Create a date using local time components: Jan 15, 2026
      // This uses the local constructor which creates a date in the machine's timezone
      const dateLocalTime = new Date(2026, 0, 15);
      const result = localDateOnlyString(dateLocalTime);

      // Verify that it returns the year, month, day we passed in local time
      expect(result).toBe('2026-01-15');

      // If this were using toISOString() or UTC components, a date constructed
      // in local time would return different values for timezones offset from UTC
    });
  });

  describe('priorityBarCount', () => {
    it('returns 3 for high priority', () => {
      expect(priorityBarCount('high')).toBe(3);
    });

    it('returns 2 for medium priority', () => {
      expect(priorityBarCount('medium')).toBe(2);
    });

    it('returns 2 when priority is undefined', () => {
      expect(priorityBarCount(undefined)).toBe(2);
    });

    it('returns 1 for low priority', () => {
      expect(priorityBarCount('low')).toBe(1);
    });
  });

  describe('taskStatus', () => {
    it('returns the task status when present', () => {
      expect(taskStatus({ id: 'task1', status: 'pending' })).toBe('pending');
      expect(taskStatus({ id: 'task1', status: 'in_progress' })).toBe(
        'in_progress',
      );
      expect(taskStatus({ id: 'task1', status: 'done' })).toBe('done');
      expect(taskStatus({ id: 'task1', status: 'cancelled' })).toBe(
        'cancelled',
      );
    });

    it('defaults to "pending" when status is undefined', () => {
      expect(taskStatus({ id: 'task1' })).toBe('pending');
      expect(taskStatus({ id: 'task1', status: undefined })).toBe('pending');
    });
  });

  describe('findVisibleTask', () => {
    it('returns the task when found and not archived', () => {
      const records = [
        {
          id: 'task1',
          title: 'Task 1',
          status: 'pending' as const,
        },
        {
          id: 'task2',
          title: 'Task 2',
          status: 'done' as const,
        },
      ];

      const result = findVisibleTask(records, 'task2');

      expect(result).toEqual({ id: 'task2', title: 'Task 2', status: 'done' });
    });

    it('returns null when task id is not found', () => {
      const records = [
        {
          id: 'task1',
          title: 'Task 1',
        },
      ];

      expect(findVisibleTask(records, 'nonexistent')).toBeNull();
    });

    it('returns null when task is archived', () => {
      const records = [
        {
          id: 'task1',
          title: 'Task 1',
          archived: true,
        },
      ];

      expect(findVisibleTask(records, 'task1')).toBeNull();
    });

    it('returns null for non-array records', () => {
      expect(findVisibleTask(null, 'task1')).toBeNull();
      expect(findVisibleTask(undefined, 'task1')).toBeNull();
      expect(findVisibleTask('not an array', 'task1')).toBeNull();
      expect(findVisibleTask({}, 'task1')).toBeNull();
    });

    it('returns null when records contain malformed entries', () => {
      const records = [
        {
          id: '',
          title: 'No ID',
        },
        null,
        undefined,
        {
          title: 'No ID field',
        },
      ];

      expect(findVisibleTask(records, 'task1')).toBeNull();
    });
  });

  describe('taskOnDetail', () => {
    const saved = { id: 'task1', title: 'Renew passport' };

    it('draws the Task in the copy when nothing is being removed', () => {
      expect(taskOnDetail(saved, null)).toBe(saved);
    });

    it('draws the Task the User removed while its push is in flight', () => {
      // The edit has already taken it out of the copy.
      expect(taskOnDetail(findVisibleTask([], 'task1'), saved)).toBe(saved);
    });

    it('draws the Task an archive took out of the copy', () => {
      const archived = [{ ...saved, archived: true }];

      expect(taskOnDetail(findVisibleTask(archived, 'task1'), saved)).toBe(
        saved,
      );
    });

    it('draws the copy, not the one remembered, once a refused push put it back', () => {
      const reverted = { id: 'task1', title: 'Renew passport (edited)' };

      expect(taskOnDetail(reverted, saved)).toBe(reverted);
    });

    it('draws nothing for a Task this screen did not remove', () => {
      expect(taskOnDetail(findVisibleTask([], 'task1'), null)).toBeNull();
    });
  });

  describe('taskRemovalPhase', () => {
    const saved = { id: 'task1', title: 'Renew passport' };
    const idle = { busy: false, refused: false };
    const sent: TaskRemoval = { task: saved, kind: 'delete', sent: true };

    it('is "none" when the User removed nothing, whatever the copy holds', () => {
      expect(taskRemovalPhase(null, saved, idle)).toBe('none');
      // Gone from the copy without a removal here: another device did it.
      expect(taskRemovalPhase(null, null, idle)).toBe('none');
      expect(taskRemovalPhase(null, null, { busy: false, refused: true })).toBe(
        'none',
      );
    });

    it('is "sending" while the removal waits behind another write', () => {
      const waiting: TaskRemoval = { ...sent, sent: false };

      expect(taskRemovalPhase(waiting, saved, idle)).toBe('sending');
      expect(
        taskRemovalPhase(waiting, saved, { busy: true, refused: false }),
      ).toBe('sending');
    });

    it('is "sending", not "landed", while the push is in flight and the copy already lacks the Task', () => {
      expect(taskRemovalPhase(sent, null, { busy: true, refused: false })).toBe(
        'sending',
      );
    });

    it('is "landed" once the request has settled and the Task is gone', () => {
      expect(taskRemovalPhase(sent, null, idle)).toBe('landed');
    });

    it('is "refused" when the push failed and the Task is back', () => {
      expect(
        taskRemovalPhase(sent, saved, { busy: false, refused: true }),
      ).toBe('refused');
    });

    it('is "sending" again while a retry or a reload sends the held edit', () => {
      // A retry takes the Task out of the copy again; a reload may not yet.
      const sending = { busy: true, refused: true };

      expect(taskRemovalPhase(sent, null, sending)).toBe('sending');
      expect(taskRemovalPhase(sent, saved, sending)).toBe('sending');
    });

    it('is "landed" when a held removal reaches the server by a retry or a reload', () => {
      // Whatever the Vault last reported, the Task is gone and nothing runs.
      expect(taskRemovalPhase(sent, null, idle)).toBe('landed');
      expect(taskRemovalPhase(sent, null, { busy: false, refused: true })).toBe(
        'landed',
      );
    });

    it('is "dropped" when the Task is back and the Vault holds nothing', () => {
      expect(taskRemovalPhase(sent, saved, idle)).toBe('dropped');
    });

    it('reads an archive the same way as a delete', () => {
      const archive: TaskRemoval = { ...sent, kind: 'archive' };

      expect(taskRemovalPhase(archive, null, idle)).toBe('landed');
      expect(
        taskRemovalPhase(archive, saved, { busy: false, refused: true }),
      ).toBe('refused');
    });
  });

  describe('taskRemovalNoticePlace', () => {
    it('puts a refused removal’s notice in the confirm sheet while it is up', () => {
      expect(taskRemovalNoticePlace('refused', true)).toBe('sheet');
    });

    it('puts it on the screen when no sheet covers it', () => {
      expect(taskRemovalNoticePlace('refused', false)).toBe('screen');
    });

    it('draws no notice in any other phase', () => {
      for (const phase of ['none', 'sending', 'landed', 'dropped'] as const) {
        expect(taskRemovalNoticePlace(phase, true)).toBeNull();
        expect(taskRemovalNoticePlace(phase, false)).toBeNull();
      }
    });
  });

  describe('selectOpenTaskGroups', () => {
    const now = new Date('2026-01-15');

    it('includes only pending, in_progress, and blocked tasks', () => {
      const records = [
        {
          id: 'pending-task',
          title: 'Pending',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'in-progress-task',
          title: 'In Progress',
          status: 'in_progress' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'blocked-task',
          title: 'Blocked',
          status: 'blocked' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'done-task',
          title: 'Done',
          status: 'done' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cancelled-task',
          title: 'Cancelled',
          status: 'cancelled' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);

      // All groups flattened to find all task ids
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));
      expect(allTaskIds).toContain('pending-task');
      expect(allTaskIds).toContain('in-progress-task');
      expect(allTaskIds).toContain('blocked-task');
      expect(allTaskIds).not.toContain('done-task');
      expect(allTaskIds).not.toContain('cancelled-task');
    });

    it('excludes archived tasks', () => {
      const records = [
        {
          id: 'visible-task',
          title: 'Visible',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          archived: false,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'archived-task',
          title: 'Archived',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          archived: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('visible-task');
      expect(allTaskIds).not.toContain('archived-task');
    });

    it('groups tasks by due date: overdue, today, upcoming, noDate', () => {
      const records = [
        {
          id: 'overdue-task',
          title: 'Overdue',
          status: 'pending' as const,
          dueDate: '2026-01-14',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'today-task',
          title: 'Today',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'upcoming-task',
          title: 'Upcoming',
          status: 'pending' as const,
          dueDate: '2026-01-16',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-date-task',
          title: 'No Date',
          status: 'pending' as const,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);

      expect(groups).toHaveLength(4);
      expect(groups[0].key).toBe('overdue');
      expect(groups[0].tasks[0].id).toBe('overdue-task');
      expect(groups[1].key).toBe('today');
      expect(groups[1].tasks[0].id).toBe('today-task');
      expect(groups[2].key).toBe('upcoming');
      expect(groups[2].tasks[0].id).toBe('upcoming-task');
      expect(groups[3].key).toBe('noDate');
      expect(groups[3].tasks[0].id).toBe('no-date-task');
    });

    it('omits groups with no tasks', () => {
      const records = [
        {
          id: 'today-task',
          title: 'Today',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);

      // Only the "today" group should exist; overdue, upcoming, noDate omitted
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('today');

      const groupKeys = groups.map((g) => g.key);
      expect(groupKeys).not.toContain('overdue');
      expect(groupKeys).not.toContain('upcoming');
      expect(groupKeys).not.toContain('noDate');
    });

    it('filters by context: "all" includes all contexts', () => {
      const records = [
        {
          id: 'personal-task',
          title: 'Personal',
          status: 'pending' as const,
          context: 'personal' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-task',
          title: 'Work',
          status: 'pending' as const,
          context: 'work' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-context-task',
          title: 'No Context',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('personal-task');
      expect(allTaskIds).toContain('work-task');
      expect(allTaskIds).toContain('no-context-task');
    });

    it('filters by context: "personal" includes only personal tasks', () => {
      const records = [
        {
          id: 'personal-task',
          title: 'Personal',
          status: 'pending' as const,
          context: 'personal' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-task',
          title: 'Work',
          status: 'pending' as const,
          context: 'work' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-context-task',
          title: 'No Context',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'personal', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('personal-task');
      expect(allTaskIds).not.toContain('work-task');
      expect(allTaskIds).not.toContain('no-context-task');
    });

    it('filters by context: "work" includes only work tasks', () => {
      const records = [
        {
          id: 'personal-task',
          title: 'Personal',
          status: 'pending' as const,
          context: 'personal' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-task',
          title: 'Work',
          status: 'pending' as const,
          context: 'work' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'work', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('work-task');
      expect(allTaskIds).not.toContain('personal-task');
    });

    it('sorts within a group by priority (high < medium < low)', () => {
      const records = [
        {
          id: 'low-task',
          title: 'Low',
          status: 'pending' as const,
          priority: 'low' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'high-task',
          title: 'High',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'medium-task',
          title: 'Medium',
          status: 'pending' as const,
          priority: 'medium' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const todayGroup = groups.find((g) => g.key === 'today');

      expect(todayGroup?.tasks[0].id).toBe('high-task');
      expect(todayGroup?.tasks[1].id).toBe('medium-task');
      expect(todayGroup?.tasks[2].id).toBe('low-task');
    });

    it('sorts within equal priority by due date (earlier first)', () => {
      const records = [
        {
          id: 'task-jan20',
          title: 'Jan 20',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-20',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'task-jan10',
          title: 'Jan 10',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-10',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'task-jan15',
          title: 'Jan 15',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      // When sorted across groups by due date, they should appear in order:
      // overdue (jan10), today (jan15), upcoming (jan20)
      expect(allTaskIds).toEqual(['task-jan10', 'task-jan15', 'task-jan20']);
    });

    it('sorts by createdAt when priority and due date tie', () => {
      const records = [
        {
          id: 'created-later',
          title: 'Created later',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-02T00:00:00Z',
        },
        {
          id: 'created-earlier',
          title: 'Created earlier',
          status: 'pending' as const,
          priority: 'high' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const todayGroup = groups.find((g) => g.key === 'today');

      expect(todayGroup?.tasks[0].id).toBe('created-earlier');
      expect(todayGroup?.tasks[1].id).toBe('created-later');
    });

    it('drops malformed entries and non-objects', () => {
      const records = [
        {
          id: 'valid-task',
          title: 'Valid',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '',
          title: 'No ID',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
        null,
        undefined,
        'not an object',
        {
          title: 'Missing id field',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

      expect(allTaskIds).toHaveLength(1);
      expect(allTaskIds[0]).toBe('valid-task');
    });

    it('returns empty array for non-array records', () => {
      expect(selectOpenTaskGroups(null, 'all', now)).toEqual([]);
      expect(selectOpenTaskGroups(undefined, 'all', now)).toEqual([]);
      expect(selectOpenTaskGroups('not an array', 'all', now)).toEqual([]);
      expect(selectOpenTaskGroups({}, 'all', now)).toEqual([]);
    });

    it('includes group labels', () => {
      const records = [
        {
          id: 'task1',
          title: 'Task',
          status: 'pending' as const,
          dueDate: '2026-01-15',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const groups = selectOpenTaskGroups(records, 'all', now);

      expect(groups[0].label).toBe('Today');
    });
  });

  describe('selectClosedTaskSections', () => {
    it('returns done section for done tasks', () => {
      const records = [
        {
          id: 'done-task',
          title: 'Done Task',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');

      expect(sections).toHaveLength(1);
      expect(sections[0].key).toBe('done');
      expect(sections[0].label).toBe('Done');
      expect(sections[0].tasks[0].id).toBe('done-task');
    });

    it('returns cancelled section for cancelled tasks', () => {
      const records = [
        {
          id: 'cancelled-task',
          title: 'Cancelled Task',
          status: 'cancelled' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');

      expect(sections).toHaveLength(1);
      expect(sections[0].key).toBe('cancelled');
      expect(sections[0].label).toBe('Cancelled');
      expect(sections[0].tasks[0].id).toBe('cancelled-task');
    });

    it('returns done section before cancelled section', () => {
      const records = [
        {
          id: 'done-task',
          title: 'Done Task',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cancelled-task',
          title: 'Cancelled Task',
          status: 'cancelled' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');

      expect(sections).toHaveLength(2);
      expect(sections[0].key).toBe('done');
      expect(sections[1].key).toBe('cancelled');
    });

    it('excludes archived tasks', () => {
      const records = [
        {
          id: 'visible-done',
          title: 'Visible Done',
          status: 'done' as const,
          archived: false,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'archived-done',
          title: 'Archived Done',
          status: 'done' as const,
          archived: true,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('visible-done');
      expect(allTaskIds).not.toContain('archived-done');
    });

    it('applies context filter: "all" includes all contexts', () => {
      const records = [
        {
          id: 'personal-done',
          title: 'Personal Done',
          status: 'done' as const,
          context: 'personal' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-done',
          title: 'Work Done',
          status: 'done' as const,
          context: 'work' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-context-done',
          title: 'No Context Done',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('personal-done');
      expect(allTaskIds).toContain('work-done');
      expect(allTaskIds).toContain('no-context-done');
    });

    it('applies context filter: "personal" includes only personal tasks', () => {
      const records = [
        {
          id: 'personal-done',
          title: 'Personal Done',
          status: 'done' as const,
          context: 'personal' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-done',
          title: 'Work Done',
          status: 'done' as const,
          context: 'work' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'personal');
      const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));

      expect(allTaskIds).toContain('personal-done');
      expect(allTaskIds).not.toContain('work-done');
    });

    it('applies context filter: "work" includes only work tasks', () => {
      const records = [
        {
          id: 'personal-done',
          title: 'Personal Done',
          status: 'done' as const,
          context: 'personal' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'work-done',
          title: 'Work Done',
          status: 'done' as const,
          context: 'work' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'work');
      const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));

      expect(allTaskIds).not.toContain('personal-done');
      expect(allTaskIds).toContain('work-done');
    });

    it('omits a section when it has no tasks', () => {
      const records = [
        {
          id: 'done-task',
          title: 'Done',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');

      expect(sections).toHaveLength(1);
      expect(sections[0].key).toBe('done');

      const sectionKeys = sections.map((s) => s.key);
      expect(sectionKeys).not.toContain('cancelled');
    });

    it('sorts within a section by closedAt descending (most recent first)', () => {
      const records = [
        {
          id: 'closed-first',
          title: 'Closed First',
          status: 'done' as const,
          closedAt: '2026-01-10T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'closed-last',
          title: 'Closed Last',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'closed-middle',
          title: 'Closed Middle',
          status: 'done' as const,
          closedAt: '2026-01-12T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const doneSection = sections.find((s) => s.key === 'done');

      expect(doneSection?.tasks[0].id).toBe('closed-last');
      expect(doneSection?.tasks[1].id).toBe('closed-middle');
      expect(doneSection?.tasks[2].id).toBe('closed-first');
    });

    it('falls back to updatedAt when closedAt ties', () => {
      const records = [
        {
          id: 'updated-first',
          title: 'Updated First',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          updatedAt: '2026-01-10T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'updated-last',
          title: 'Updated Last',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          updatedAt: '2026-01-20T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const doneSection = sections.find((s) => s.key === 'done');

      expect(doneSection?.tasks[0].id).toBe('updated-last');
      expect(doneSection?.tasks[1].id).toBe('updated-first');
    });

    it('falls back to createdAt when closedAt and updatedAt tie', () => {
      const records = [
        {
          id: 'created-first',
          title: 'Created First',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          updatedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'created-last',
          title: 'Created Last',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          updatedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-10T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const doneSection = sections.find((s) => s.key === 'done');

      expect(doneSection?.tasks[0].id).toBe('created-last');
      expect(doneSection?.tasks[1].id).toBe('created-first');
    });

    it('handles legacy tasks with no closedAt field (both missing)', () => {
      const records = [
        {
          id: 'legacy-no-closed',
          title: 'Legacy no closed',
          status: 'done' as const,
          updatedAt: '2026-01-10T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'legacy-no-updated',
          title: 'Legacy no updated',
          status: 'done' as const,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'newer-with-closed',
          title: 'Newer with closed',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const doneSection = sections.find((s) => s.key === 'done');

      // Tasks with closedAt come first
      expect(doneSection?.tasks[0].id).toBe('newer-with-closed');
      // Then legacy tasks sorted by updatedAt/createdAt
      expect(doneSection?.tasks).toHaveLength(3);
    });

    it('proves closedAt is primary sort key: closedAt beats newer updatedAt', () => {
      const records = [
        {
          id: 'with-closed-old',
          title: 'With closedAt, old',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z', // Closed on Jan 15 (primary key)
          updatedAt: '2026-01-10T12:00:00Z', // Updated on Jan 10 (older)
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'no-closed-new',
          title: 'No closedAt, new',
          status: 'done' as const,
          // No closedAt (treated as 0 in sorting)
          updatedAt: '2026-01-20T12:00:00Z', // Updated on Jan 20 (newer)
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const doneSection = sections.find((s) => s.key === 'done');

      // The task with closedAt=Jan15 should come first (primary key),
      // even though the other task has updatedAt=Jan20 (newer).
      // This proves closedAt is the primary sort, not an occasional tiebreaker.
      expect(doneSection?.tasks[0].id).toBe('with-closed-old');
      expect(doneSection?.tasks[1].id).toBe('no-closed-new');
    });

    it('returns empty array for non-array records', () => {
      expect(selectClosedTaskSections(null, 'all')).toEqual([]);
      expect(selectClosedTaskSections(undefined, 'all')).toEqual([]);
      expect(selectClosedTaskSections('not an array', 'all')).toEqual([]);
      expect(selectClosedTaskSections({}, 'all')).toEqual([]);
    });

    it('drops malformed entries', () => {
      const records = [
        {
          id: 'valid-done',
          title: 'Valid Done',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '',
          title: 'No ID',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        null,
        {
          title: 'Missing id field',
          status: 'done' as const,
          closedAt: '2026-01-15T12:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sections = selectClosedTaskSections(records, 'all');
      const allTaskIds = sections.flatMap((s) => s.tasks.map((t) => t.id));

      expect(allTaskIds).toHaveLength(1);
      expect(allTaskIds[0]).toBe('valid-done');
    });
  });
});
