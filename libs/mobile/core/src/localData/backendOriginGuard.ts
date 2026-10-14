// The data guard: local data belongs to the backend origin it came from.
//
// The app records which API origin its local data belongs to, and which Users
// have held local data under it. When a launch finds a different origin — which
// only a debug build can produce, through the bundle-time switch — it clears
// those Users' local data before the first request, so nothing from one
// backend reaches another (PRD #956, story 16).
//
// Pure: the record store and the clear function are supplied, so this runs
// under the node Jest environment.
import type { ClearUserLocalData } from './clearUserLocalData';

export interface BackendOriginRecord {
  /** The API origin the local data belongs to, or null before the first launch that recorded one. */
  origin: string | null;
  /** Users who have held local data under that origin. */
  userIds: readonly string[];
}

export interface BackendOriginStore {
  read: () => BackendOriginRecord;
  write: (record: BackendOriginRecord) => void;
}

/**
 * Whether local data may be used against `currentOrigin` as it is. A missing
 * record counts as a change: data whose origin is unknown is not trusted, and
 * on a fresh installation there is nothing to clear anyway.
 */
export function isBackendOriginUnchanged(
  record: BackendOriginRecord,
  currentOrigin: string,
): boolean {
  return record.origin === currentOrigin;
}

export type BackendOriginGuardOutcome = 'unchanged' | 'cleared';

/**
 * Runs the guard. On a change, clears every User the record names, plus
 * `additionalUserIds` (Users this installation knew of before the record
 * existed), then records the new origin with no Users. The record is written
 * only after the clear succeeds, so a failed clear is retried next launch.
 */
export async function guardBackendOrigin(params: {
  currentOrigin: string;
  store: BackendOriginStore;
  clearUserLocalData: ClearUserLocalData;
  additionalUserIds?: readonly string[];
}): Promise<BackendOriginGuardOutcome> {
  const record = params.store.read();
  if (isBackendOriginUnchanged(record, params.currentOrigin)) {
    return 'unchanged';
  }
  await params.clearUserLocalData([
    ...record.userIds,
    ...(params.additionalUserIds ?? []),
  ]);
  params.store.write({ origin: params.currentOrigin, userIds: [] });
  return 'cleared';
}

/**
 * Records that `userId` holds local data under the current origin. Returns
 * the record unchanged when it already does.
 */
export function withLocalDataOwner(
  record: BackendOriginRecord,
  userId: string,
): BackendOriginRecord {
  if (record.userIds.includes(userId)) return record;
  return { ...record, userIds: [...record.userIds, userId] };
}
