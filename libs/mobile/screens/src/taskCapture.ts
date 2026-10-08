import type {
  Task,
  TaskContext,
  TaskPriority,
} from '@myorganizer/vault-core/portable';
import { localDateOnlyString } from './taskModel';

/** Which due date, if any, a captured Task starts with. */
export type DueChoice = 'none' | 'today' | 'tomorrow' | 'custom';

/**
 * What the Tasks composer holds before it is saved: the title as typed and
 * the chips as chosen. Plaintext, and client-only — it lives in the screen's
 * state and nowhere else.
 */
export interface TaskDraft {
  title: string;
  dueChoice: DueChoice;
  customDate: string | null;
  priority: TaskPriority | undefined;
  context: TaskContext | undefined;
}

export const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  dueChoice: 'none',
  customDate: null,
  priority: undefined,
  context: undefined,
};

/**
 * A capture whose Vault Push has not landed: the Task that was sent, and the
 * draft it was made from. The draft stays in the composer for as long as this
 * is held ([ADR 0107](../../../../docs/adr/0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md)
 * item 5: "A typed task title stays in its field until the push lands").
 */
export interface UnsentCapture {
  task: Task;
  draft: TaskDraft;
  /**
   * Earlier captures that have not landed either, oldest first. The Vault
   * holds one failed edit, and the next write lets go of it, so each new
   * capture's push puts these again along with its own Task (#1007: a second
   * Task saved while the first add is still held loses neither).
   */
  carried: readonly Task[];
}

/**
 * Whether two drafts would capture the same Task. The title is compared as
 * it is saved, trimmed; a custom date counts only while it is the choice.
 */
export function sameTaskDraft(a: TaskDraft, b: TaskDraft): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.dueChoice === b.dueChoice &&
    (a.dueChoice !== 'custom' || a.customDate === b.customDate) &&
    a.priority === b.priority &&
    a.context === b.context
  );
}

function dueDateOf(draft: TaskDraft, now: Date): string | undefined {
  switch (draft.dueChoice) {
    case 'today':
      return localDateOnlyString(now);
    case 'tomorrow':
      return localDateOnlyString(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      );
    case 'custom':
      return draft.customDate ?? undefined;
    case 'none':
      return undefined;
  }
}

/**
 * The Task a press of Save sends, or `null` when the title is blank.
 *
 * A draft that has not changed since a capture that did not land is that
 * same Task again, id and all — not a second one. So pressing Save again
 * after a refused push does what Retry does, and a push the server did store
 * before its answer was lost is written over rather than duplicated. A draft
 * that was changed since is a new Task with a new id, and the one before it
 * is carried into the same push (`nextUnsentCapture`) rather than dropped:
 * whether the User was correcting the first title or writing a second Task
 * over it cannot be told apart, and two Tasks can be put right where a lost
 * one cannot.
 */
export function taskToCapture(
  draft: TaskDraft,
  unsent: UnsentCapture | null,
  make: { id: () => string; now: Date },
): Task | null {
  const title = draft.title.trim();
  if (title.length === 0) return null;
  if (unsent !== null && sameTaskDraft(draft, unsent.draft)) return unsent.task;
  const dueDate = dueDateOf(draft, make.now);
  return {
    id: make.id(),
    title,
    status: 'pending',
    priority: draft.priority ?? 'medium',
    archived: false,
    createdAt: make.now.toISOString(),
    ...(dueDate != null ? { dueDate } : {}),
    ...(draft.context != null ? { context: draft.context } : {}),
  };
}

/**
 * What is unsent once `task` has been captured from `draft`. The same Task
 * again keeps what it carried; a new one carries the capture it follows, and
 * everything that one carried.
 */
export function nextUnsentCapture(
  task: Task,
  draft: TaskDraft,
  unsent: UnsentCapture | null,
): UnsentCapture {
  if (unsent === null) return { task, draft, carried: [] };
  if (task.id === unsent.task.id) {
    return { task, draft, carried: unsent.carried };
  }
  return { task, draft, carried: [...unsent.carried, unsent.task] };
}

/** Every Task a capture's push puts, oldest first, its own last. */
export function tasksToSend(capture: UnsentCapture): readonly Task[] {
  return [...capture.carried, capture.task];
}

/**
 * Whether the capture's Task is on the server: it is in the copy on screen
 * and no write is in flight. While a push runs the copy on screen already
 * holds the Task, Unconfirmed, and a refused push takes it out again — so
 * `writing` is what tells the two apart. Read from the copy rather than from
 * one push's answer, so a retry and a reload that sent the edit both count.
 */
export function captureLanded(
  unsent: UnsentCapture | null,
  records: unknown,
  writing: boolean,
): boolean {
  if (unsent === null || writing || !Array.isArray(records)) return false;
  return records.some(
    (entry: unknown) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { id?: unknown }).id === unsent.task.id,
  );
}

/**
 * What the composer holds once a capture has landed: nothing, when it still
 * holds the draft that was sent; otherwise what the User has typed since,
 * which is the start of another Task.
 */
export function draftAfterLanding(
  current: TaskDraft,
  landed: UnsentCapture,
): TaskDraft {
  return sameTaskDraft(current, landed.draft) ? EMPTY_TASK_DRAFT : current;
}
