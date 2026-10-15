import { withLocalDataOwner } from './backendOriginGuard';
import { backendOriginStore } from './backendOriginStorage';

/**
 * Records that this User holds local data under the current backend origin,
 * so that a later origin change clears theirs too. Called whenever a User is
 * signed in; a no-op once they are recorded.
 */
export function rememberLocalDataOwner(userId: string): void {
  const record = backendOriginStore.read();
  const next = withLocalDataOwner(record, userId);
  if (next !== record) backendOriginStore.write(next);
}
