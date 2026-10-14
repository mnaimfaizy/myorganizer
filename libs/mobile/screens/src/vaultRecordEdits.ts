// The record edits the Task, Subscription and Usage Location screens push.
//
// Pure, so they run under the node Jest environment (ADR 0103): the screens
// close over them, and a test applies the very function a screen sends.
//
// Each edit builds on the record as the envelope it is applied to holds it,
// and falls back to the copy the screen drew only when that envelope no longer
// has the record. An edit is re-run against a newer copy after a conflict, so
// building on the screen's copy would overwrite whatever another device wrote
// in between — Unknown Fields among it (ADR 0114 decision 3).
import {
  putVaultRecord,
  type SubscriptionRecord,
  type Task,
  type UsageLocationRecord,
  type VaultBlobEnvelope,
} from '@myorganizer/vault-core/portable';
import { readUsageLocations } from './contactModel';
import type { SubscriptionEditValues } from './SubscriptionEditSheet';
import { findVisibleSubscription } from './subscriptionModel';
import { findVisibleTask, type DecryptedTask } from './taskModel';

/** What a screen hands the push path: one envelope in, the edited one out. */
export type RecordEdit = (
  envelope: VaultBlobEnvelope<unknown>,
) => VaultBlobEnvelope<unknown>;

/** The Task as `envelope` holds it, or the one on screen when it holds none. */
export function storedTask(
  envelope: VaultBlobEnvelope<unknown>,
  task: DecryptedTask,
): Task {
  return (
    (findVisibleTask(envelope.records, task.id) as Task | null) ??
    (task as Task)
  );
}

/**
 * The Subscription Detail edit: status, amount, next billing date and, for a
 * cancellation, its date and reason, applied to the stored Subscription.
 */
export function subscriptionEdit(
  fallback: SubscriptionRecord,
  values: SubscriptionEditValues,
  now: string,
): RecordEdit {
  return (envelope) => {
    const current =
      (findVisibleSubscription(
        envelope.records,
        fallback.id,
      ) as SubscriptionRecord | null) ?? fallback;
    const next: SubscriptionRecord = {
      ...current,
      status: values.status,
      amount: values.amount,
      updatedAt: now,
    };
    if (values.nextBillingDate != null) {
      next.nextBillingDate = values.nextBillingDate;
    } else {
      delete next.nextBillingDate;
    }
    if (values.status === 'cancelled') {
      next.cancellationDate = values.cancellationDate;
      if (values.cancellationReason != null) {
        next.cancellationReason = values.cancellationReason;
      } else {
        delete next.cancellationReason;
      }
    }
    return putVaultRecord(envelope, next);
  };
}

/** An Address or Mobile Number, decrypted and defensively parsed. */
export type ToggleableContact = Record<string, unknown> & {
  id: string;
  usageLocations?: unknown;
};

/** The record carrying `id` in a decrypted records array, or `null`. */
function storedContact(records: unknown, id: string): ToggleableContact | null {
  if (!Array.isArray(records)) return null;
  const found: unknown = records.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { id?: unknown }).id === id,
  );
  return (found as ToggleableContact | undefined) ?? null;
}

/**
 * Sets one Usage Location's notified state on an Address or Mobile Number.
 * Sibling Usage Locations are carried as stored.
 */
export function usageLocationToggleEdit(
  fallback: ToggleableContact,
  locationId: string,
  notified: boolean,
  now: string,
): RecordEdit {
  return (envelope) => {
    const current = storedContact(envelope.records, fallback.id) ?? fallback;
    const usageLocations = readUsageLocations(current).map((entry) => {
      if (entry.id !== locationId) return entry;
      const updated = { ...entry, changed: notified };
      if (notified) {
        updated.changedAt = now;
      } else {
        delete updated.changedAt;
      }
      return updated;
    });
    return putVaultRecord(envelope, {
      ...current,
      usageLocations: usageLocations as UsageLocationRecord[],
      updatedAt: now,
    });
  };
}
