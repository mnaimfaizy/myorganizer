import { mergeRecordsById } from './mergeVaultRecords';
import type { SubscriptionRecord } from './subscriptionRecords';
import type { VaultBlobEnvelope } from './vaultBlobEnvelope';

/**
 * When a Subscription last changed, for merge purposes.
 *
 * Only `updatedAt` answers this. `startDate` is when the User's subscription
 * began, not when the record was touched — a subscription started in 2019 and
 * edited this morning would lose every collision if that field were read as a
 * record timestamp.
 */
function subscriptionChangedAt(
  subscription: SubscriptionRecord,
): string | undefined {
  return subscription.updatedAt;
}

/**
 * Converges two copies of the `subscriptions` Vault Blob.
 *
 * Pure: no crypto, no storage, no clock. Two copies that both predate
 * `updatedAt` are indistinguishable in age, so the local one is kept and a
 * deletion wins — see `mergeRecordsById`.
 *
 * That last part binds whoever writes deletions. A Subscription is the one
 * record type here with no `createdAt` to fall back on, so an unstamped one
 * has no age at all and cannot outlive a deletion, however old the deletion
 * is. The write path that starts recording deletions must therefore stamp
 * `updatedAt` on edit, or "a record edited after its deletion survives" is
 * true for Tasks, Addresses and Mobile Numbers and false here.
 */
export function mergeSubscriptions(
  local: VaultBlobEnvelope<SubscriptionRecord[]>,
  remote: VaultBlobEnvelope<SubscriptionRecord[]>,
): VaultBlobEnvelope<SubscriptionRecord[]> {
  return mergeRecordsById(local, remote, subscriptionChangedAt);
}
