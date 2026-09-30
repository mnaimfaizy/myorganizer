import type { TabName } from './tabs';

/**
 * The Tasks tab, named out of the one tab vocabulary rather than as a loose
 * string — see `groceriesStack.ts`, which this mirrors.
 */
type TasksTab = Extract<TabName, 'Tasks'>;

/** The Tasks tab's own navigation stack: its list, and one Task's detail. */
export type TasksStackParamList = {
  [Home in `${TasksTab}Home`]: undefined;
} & {
  /** One Task's detail — every field, and Delete. */
  TaskDetail: { taskId: string };
};

/** The route names, in one place — see `GROCERIES_ROUTES` for why. */
export const TASKS_ROUTES = {
  home: 'TasksHome',
  detail: 'TaskDetail',
} as const satisfies Record<string, keyof TasksStackParamList>;
