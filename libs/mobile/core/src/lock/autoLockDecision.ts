// Whether the Vault should be locked now that the Mobile App is back in the
// foreground (ADR 0108 decision 6).
//
// A pure function over three numbers, so the rule is testable without an
// `AppState` subscription, a timer, or a device. Nothing here locks anything:
// the caller owns the in-memory Master Key and is the only thing that can drop
// it.
import { autoLockDelayMs, type AutoLockDelay } from './autoLockDelay';

/** What the decision is made from. */
export interface AutoLockInput {
  /**
   * When the app last left the foreground, as `Date.now()`, or `null` when it
   * has not left it since the Vault was unlocked.
   */
  backgroundedAt: number | null;
  /** Now, as `Date.now()`. */
  now: number;
  /** The Auto-Lock Delay Device Setting this device is on. */
  delay: AutoLockDelay;
}

/**
 * Whether returning to the foreground should lock the Vault.
 *
 * Three rules, and the two that are not arithmetic both fail towards locking:
 *
 * - An app that never left the foreground has nothing to lock for. That is the
 *   only `false` that is not a comparison, and it is what keeps a privacy
 *   cover raised for a system permission dialog from locking the Vault behind
 *   it — the cover goes up on `inactive`, the clock starts on `background`.
 * - Elapsed time is measured against the delay **inclusively**: at exactly the
 *   configured delay the Vault locks. A boundary that went the other way would
 *   make `immediately` — a zero delay, and the one choice a User picks because
 *   they mean it — never lock at all.
 * - A `now` before `backgroundedAt` means the device clock moved under us while
 *   the app was away, so elapsed time is not a fact this device has. It locks:
 *   the cost of being wrong is a passphrase, and the cost the other way is a
 *   Vault left open by moving a clock.
 */
export function shouldAutoLock({
  backgroundedAt,
  now,
  delay,
}: AutoLockInput): boolean {
  if (backgroundedAt === null) return false;

  const elapsed = now - backgroundedAt;
  if (elapsed < 0) return true;

  return elapsed >= autoLockDelayMs(delay);
}
