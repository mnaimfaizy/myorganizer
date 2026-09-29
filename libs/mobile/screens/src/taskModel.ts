import {
  compareTasksByPriorityDueDateCreated,
  isClosedTaskStatus,
  type Task,
  type TaskContext,
  type TaskPriority,
  type TaskStatus,
} from '@myorganizer/vault-core/portable';

/**
 * What the Tasks screens read out of a decrypted Tasks Vault Blob.
 *
 * The payload is decrypted JSON written by some build of some client, so
 * every field but `id` is a claim — the same defensive reading
 * `groceryTripModel.ts` does for Groceries. This module holds no React and
 * imports no `react-native`, which is what lets `libs/mobile/screens`' Jest
 * project — a `node` environment with no renderer — cover it.
 */
export type DecryptedTask = Partial<Task> & { id: string };

export type TaskContextFilter = 'all' | TaskContext;

export type OpenTaskGroupKey = 'overdue' | 'today' | 'upcoming' | 'noDate';

/** The open Tasks (pending, in progress, blocked) due on one day, or none. */
export interface OpenTaskGroup {
  key: OpenTaskGroupKey;
  label: string;
  tasks: DecryptedTask[];
}

export type ClosedTaskSectionKey = 'done' | 'cancelled';

/** The Done or Cancelled Tasks, shown only once "Show done" is on. */
export interface ClosedTaskSection {
  key: ClosedTaskSectionKey;
  label: string;
  tasks: DecryptedTask[];
}

const OPEN_GROUP_LABEL = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  noDate: 'No date',
} as const satisfies Record<OpenTaskGroupKey, string>;

const OPEN_GROUP_ORDER: readonly OpenTaskGroupKey[] = [
  'overdue',
  'today',
  'upcoming',
  'noDate',
];

const CLOSED_SECTION_LABEL = {
  done: 'Done',
  cancelled: 'Cancelled',
} as const satisfies Record<ClosedTaskSectionKey, string>;

const CLOSED_SECTION_ORDER: readonly ClosedTaskSectionKey[] = [
  'done',
  'cancelled',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDecryptedTask(entry: unknown): DecryptedTask | null {
  if (!isRecord(entry)) return null;
  return typeof entry.id === 'string' && entry.id.length > 0
    ? (entry as DecryptedTask)
    : null;
}

/**
 * Every Task in the payload the Mobile App may show.
 *
 * Archived Tasks remain web-only (#915): showing one here would offer no way
 * to unarchive it, so it is dropped rather than surfaced.
 */
function readVisibleTasks(records: unknown): DecryptedTask[] {
  if (!Array.isArray(records)) return [];
  const tasks: DecryptedTask[] = [];
  for (const entry of records) {
    const task = toDecryptedTask(entry);
    if (task !== null && task.archived !== true) tasks.push(task);
  }
  return tasks;
}

/** The one Task with `id`, or `null` when the payload holds none — deleted or
 * archived elsewhere while this screen was open. */
export function findVisibleTask(
  records: unknown,
  id: string,
): DecryptedTask | null {
  return readVisibleTasks(records).find((task) => task.id === id) ?? null;
}

/** A Task's status, defaulting to `pending` when the payload carries none. */
export function taskStatus(task: DecryptedTask): TaskStatus {
  return task.status ?? 'pending';
}

function matchesContext(
  task: DecryptedTask,
  filter: TaskContextFilter,
): boolean {
  return filter === 'all' || task.context === filter;
}

function timeOf(value: string | undefined): number {
  if (value == null) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Done or Cancelled Tasks: most recently closed first. Ties — including two
 * Tasks with no `closedAt`, closed before #915 added the field — fall back to
 * `updatedAt`, then `createdAt`.
 */
function byClosedOrder(a: DecryptedTask, b: DecryptedTask): number {
  const closedDelta = timeOf(b.closedAt) - timeOf(a.closedAt);
  if (closedDelta !== 0) return closedDelta;
  const updatedDelta = timeOf(b.updatedAt) - timeOf(a.updatedAt);
  if (updatedDelta !== 0) return updatedDelta;
  return timeOf(b.createdAt) - timeOf(a.createdAt);
}

/**
 * `value`'s calendar date, read as three local components.
 *
 * Never through `new Date(value)`: a bare `YYYY-MM-DD` (what the web date
 * input writes to `dueDate`) parses as UTC midnight, which reads as the
 * *previous* local day for anyone west of UTC — exactly the local-midnight
 * boundary a Task due "today" must not cross.
 */
function parseDateOnly(
  value: string,
): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match === null) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function startOfLocalDay(y: number, m: number, d: number): number {
  return new Date(y, m, d).getTime();
}

/** Which open group a due date falls into, against `now`'s local calendar day. */
export function dueDateGroup(
  dueDate: string | undefined,
  now: Date,
): OpenTaskGroupKey {
  if (dueDate == null) return 'noDate';
  const parsed = parseDateOnly(dueDate);
  if (parsed === null) return 'noDate';

  const due = startOfLocalDay(parsed.y, parsed.m, parsed.d);
  const todayStart = startOfLocalDay(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  if (due < todayStart) return 'overdue';
  if (due === todayStart) return 'today';
  return 'upcoming';
}

/**
 * The open Tasks (pending, in progress, blocked) matching `contextFilter`,
 * grouped Overdue / Today / Upcoming / No date in `now`'s local time.
 *
 * A group with nothing in it is not a group — the same convention
 * `groceryTripModel.ts` uses for a category with nothing left to pick up.
 */
export function selectOpenTaskGroups(
  records: unknown,
  contextFilter: TaskContextFilter,
  now: Date,
): OpenTaskGroup[] {
  const buckets = new Map<OpenTaskGroupKey, DecryptedTask[]>();

  for (const task of readVisibleTasks(records)) {
    if (isClosedTaskStatus(taskStatus(task))) continue;
    if (!matchesContext(task, contextFilter)) continue;

    const key = dueDateGroup(task.dueDate, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(task);
    else buckets.set(key, [task]);
  }

  const groups: OpenTaskGroup[] = [];
  for (const key of OPEN_GROUP_ORDER) {
    const tasks = buckets.get(key);
    if (tasks === undefined) continue;
    groups.push({
      key,
      label: OPEN_GROUP_LABEL[key],
      tasks: [...tasks].sort(compareTasksByPriorityDueDateCreated),
    });
  }
  return groups;
}

/**
 * The Done Tasks, then the Cancelled Tasks, matching `contextFilter` — what
 * "Show done" reveals. Each section is ordered by `closedAt`, then
 * `updatedAt`, then `createdAt`, and a section with nothing in it is omitted.
 */
export function selectClosedTaskSections(
  records: unknown,
  contextFilter: TaskContextFilter,
): ClosedTaskSection[] {
  const closed = readVisibleTasks(records).filter(
    (task) =>
      isClosedTaskStatus(taskStatus(task)) &&
      matchesContext(task, contextFilter),
  );

  const sections: ClosedTaskSection[] = [];
  for (const key of CLOSED_SECTION_ORDER) {
    const tasks = closed
      .filter((task) => taskStatus(task) === key)
      .sort(byClosedOrder);
    if (tasks.length === 0) continue;
    sections.push({ key, label: CLOSED_SECTION_LABEL[key], tasks });
  }
  return sections;
}

/**
 * How many of the priority marker's three bars are filled — high fills all
 * three, low fills one. The marker is never drawn in a destructive colour: it
 * says how urgent a Task is, where a destructive colour on this screen says
 * something is about to be removed.
 */
export function priorityBarCount(priority: TaskPriority | undefined): number {
  if (priority === 'high') return 3;
  if (priority === 'low') return 1;
  return 2;
}

/**
 * `date`'s own calendar day as `YYYY-MM-DD` — the shape the web date input
 * writes to `dueDate` — read in local time.
 *
 * Never `date.toISOString()`, which reads UTC and would write tomorrow's date
 * for a "Today" chip tapped late at night east of UTC.
 */
export function localDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
