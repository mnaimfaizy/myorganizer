import {
  countDoneThisWeek,
  countVisibleTasks,
  describeClosed,
  describeCreated,
  describeDue,
  formatEstimate,
  labelledValues,
  selectOpenTaskGroups,
  TASK_STATUS_LABEL,
  withTaskOverrides,
  type DecryptedTask,
} from './taskModel';

// Sunday 27 September 2026, mid-morning local time — the day the Tasks
// artboards are drawn on. Built from local components so every assertion
// holds in any time zone the suite runs in.
const NOW = new Date(2026, 8, 27, 10, 30);

/** An instant on a local calendar day, as `closedAt` / `createdAt` hold it. */
function localInstant(month: number, day: number, hour = 9): string {
  return new Date(2026, month, day, hour).toISOString();
}

describe('task presentation', () => {
  describe('labelledValues', () => {
    it('lists a label table’s keys in its own order', () => {
      expect(labelledValues(TASK_STATUS_LABEL)).toEqual([
        'pending',
        'in_progress',
        'blocked',
        'done',
        'cancelled',
      ]);
    });
  });

  describe('describeDue', () => {
    it('reads a date due today as "Today"', () => {
      expect(describeDue('2026-09-27', NOW)).toEqual({
        text: 'Today',
        overdue: false,
      });
    });

    it('counts overdue days, singular and plural', () => {
      expect(describeDue('2026-09-26', NOW)).toEqual({
        text: '1 day overdue',
        overdue: true,
      });
      expect(describeDue('2026-09-25', NOW)).toEqual({
        text: '2 days overdue',
        overdue: true,
      });
    });

    it('prints an upcoming date without the year this year', () => {
      expect(describeDue('2026-09-29', NOW)).toEqual({
        text: 'Tue 29 Sep',
        overdue: false,
      });
    });

    it('prints the year for an upcoming date in another year', () => {
      expect(describeDue('2027-03-03', NOW)?.text).toBe('Wed 3 Mar 2027');
    });

    it('returns null for no date or an unreadable one — never the raw ISO', () => {
      expect(describeDue(undefined, NOW)).toBeNull();
      expect(describeDue('soon', NOW)).toBeNull();
    });
  });

  describe('describeClosed', () => {
    it('reads a Task done today, yesterday, and earlier', () => {
      const done = (closedAt: string): DecryptedTask => ({
        id: 't',
        status: 'done',
        closedAt,
      });
      expect(describeClosed(done(localInstant(8, 27)), NOW)).toBe('Done today');
      expect(describeClosed(done(localInstant(8, 26)), NOW)).toBe(
        'Done yesterday',
      );
      expect(describeClosed(done(localInstant(8, 24)), NOW)).toBe(
        'Done Thu 24 Sep',
      );
    });

    it('names a Cancelled Task as cancelled', () => {
      expect(
        describeClosed(
          { id: 't', status: 'cancelled', closedAt: localInstant(8, 27) },
          NOW,
        ),
      ).toBe('Cancelled today');
    });

    it('returns null for a Task closed before closedAt existed, or an open one', () => {
      expect(describeClosed({ id: 't', status: 'done' }, NOW)).toBeNull();
      expect(
        describeClosed(
          { id: 't', status: 'pending', closedAt: localInstant(8, 27) },
          NOW,
        ),
      ).toBeNull();
    });
  });

  describe('describeCreated', () => {
    it('prints the local creation day', () => {
      expect(describeCreated(localInstant(8, 21), NOW)).toBe('Mon 21 Sep');
    });

    it('returns null when createdAt is missing or unreadable', () => {
      expect(describeCreated(undefined, NOW)).toBeNull();
      expect(describeCreated('yesterday', NOW)).toBeNull();
    });
  });

  describe('formatEstimate', () => {
    it('prints minutes below two hours', () => {
      expect(formatEstimate(15)).toBe('15 min');
      expect(formatEstimate(60)).toBe('60 min');
      expect(formatEstimate(90)).toBe('90 min');
    });

    it('prints whole hours from two hours up', () => {
      expect(formatEstimate(120)).toBe('2 h');
      expect(formatEstimate(150)).toBe('2 h 30 min');
    });

    it('returns null for no estimate or one that cannot be a duration', () => {
      expect(formatEstimate(undefined)).toBeNull();
      expect(formatEstimate(-5)).toBeNull();
      expect(formatEstimate(Number.NaN)).toBeNull();
    });
  });

  describe('countVisibleTasks', () => {
    it('counts every Task the app may show, skipping archived and malformed ones', () => {
      expect(
        countVisibleTasks([
          { id: 'a', status: 'pending' },
          { id: 'b', status: 'done' },
          { id: 'c', archived: true },
          { title: 'no id' },
          null,
        ]),
      ).toBe(2);
      expect(countVisibleTasks(undefined)).toBe(0);
    });
  });

  describe('countDoneThisWeek', () => {
    const records = [
      // Monday 21 Sep — the start of NOW's week.
      { id: 'mon', status: 'done', closedAt: localInstant(8, 21, 0) },
      { id: 'sat', status: 'done', closedAt: localInstant(8, 26) },
      {
        id: 'work',
        status: 'done',
        context: 'work',
        closedAt: localInstant(8, 27),
      },
      // Sunday 20 Sep — last week.
      { id: 'lastWeek', status: 'done', closedAt: localInstant(8, 20, 23) },
      { id: 'cancelled', status: 'cancelled', closedAt: localInstant(8, 27) },
      { id: 'legacy', status: 'done' },
      {
        id: 'archived',
        status: 'done',
        archived: true,
        closedAt: localInstant(8, 27),
      },
    ];

    it('counts Done Tasks closed since Monday, and nothing else', () => {
      expect(countDoneThisWeek(records, 'all', NOW)).toBe(3);
    });

    it('applies the context filter', () => {
      expect(countDoneThisWeek(records, 'work', NOW)).toBe(1);
      expect(countDoneThisWeek(records, 'personal', NOW)).toBe(0);
    });
  });

  describe('withTaskOverrides', () => {
    it('keeps a ticked Task in its open group until the override is dropped', () => {
      const before: DecryptedTask = {
        id: 'a',
        title: 'Pay water bill',
        status: 'blocked',
        dueDate: '2026-09-27',
      };
      const records = [{ ...before, status: 'done' }];

      expect(selectOpenTaskGroups(records, 'all', NOW)).toEqual([]);

      const shown = withTaskOverrides(records, new Map([['a', before]]));
      const groups = selectOpenTaskGroups(shown, 'all', NOW);
      expect(groups.map((group) => group.key)).toEqual(['today']);
      expect(groups[0].tasks[0].status).toBe('blocked');
    });

    it('returns the payload untouched with no overrides or no array', () => {
      const records = [{ id: 'a' }];
      expect(withTaskOverrides(records, new Map())).toBe(records);
      expect(withTaskOverrides(null, new Map([['a', { id: 'a' }]]))).toBe(null);
    });
  });
});
