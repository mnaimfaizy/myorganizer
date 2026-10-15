import { useSyncExternalStore } from 'react';
import { versionFloorRefusal } from './api/client';
import type { VersionFloorRefusal } from './api/versionFloor';

/** The backend's refusal of this build, or `null` while there is none. */
export function useVersionFloorRefusal(): VersionFloorRefusal | null {
  return useSyncExternalStore(
    versionFloorRefusal.subscribe,
    versionFloorRefusal.get,
  );
}
