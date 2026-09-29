import type { Priority, UsageLocationRecord } from './contactRecords';

/**
 * Priority as a sort key. `satisfies Record<Priority, number>` is the guard:
 * a fifth Priority member fails to compile here until it has a place in the
 * order, the same shape `taskOrder.ts` pins Task priority to.
 */
const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  normal: 2,
  low: 3,
} as const satisfies Record<Priority, number>;

/** The two fields the shared Usage Location order reads. Looser than
 * `UsageLocationRecord` on purpose: mobile sorts a decrypted, defensively
 * parsed `Partial<UsageLocationRecord>`. */
export interface UsageLocationOrderFields {
  priority?: Priority;
  createdAt?: string;
}

function timeOrFallback(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The Usage Location order: priority (High, then Medium, then Normal, then
 * Low), then created (earliest first). A record missing or carrying an
 * unparseable `priority` falls back to `normal` rather than throwing — the
 * same "oldest data has no strong opinion" default `taskOrder.ts` gives a
 * missing Task priority.
 */
export function compareUsageLocationsByPriority(
  a: UsageLocationOrderFields,
  b: UsageLocationOrderFields,
): number {
  const priorityDelta =
    PRIORITY_ORDER[a.priority ?? 'normal'] -
    PRIORITY_ORDER[b.priority ?? 'normal'];
  if (priorityDelta !== 0) return priorityDelta;

  return timeOrFallback(a.createdAt, 0) - timeOrFallback(b.createdAt, 0);
}

/** `UsageLocationRecord[]` sorted by `compareUsageLocationsByPriority`. */
export function sortUsageLocationsByPriority(
  locations: readonly UsageLocationRecord[],
): UsageLocationRecord[] {
  return [...locations].sort(compareUsageLocationsByPriority);
}
