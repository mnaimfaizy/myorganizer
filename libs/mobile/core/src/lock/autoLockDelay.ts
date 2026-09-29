// The Auto-Lock Delay Device Setting as a value: its type, its default, the
// four choices the design offers, and how a string read out of storage becomes
// one.
//
// Separate from the store for the same reason ./../settings/appearance.ts is:
// `libs/mobile/core`'s key-value storage is MMKV, a JSI module, so anything
// importing the store transitively cannot be tested at all, and the branches
// worth testing here — the boundary, and a value this build no longer accepts
// — need no storage.

/** How long the Mobile App may sit in the background before the Vault locks. */
export type AutoLockDelay = 'immediately' | '1m' | '5m' | '15m';

/**
 * What a device that has never been told otherwise does. Five minutes is
 * ADR 0108 decision 6: long enough to answer a message mid-shop, short enough
 * that a phone left on a counter is not an unlocked Vault.
 */
export const DEFAULT_AUTO_LOCK_DELAY: AutoLockDelay = '5m';

/**
 * What one Auto-Lock Delay choice is worth, and what the Unlock screen says
 * about it.
 *
 * The choice's *label* is not here. The only screen that prints one is the
 * Account row that picks between the four, and that screen is a later slice:
 * a label and an ordering written before it exists are two more things for
 * that slice to find already wrong.
 */
export interface AutoLockDelayMeta {
  /** The delay in milliseconds — what the decision compares elapsed time to. */
  ms: number;
  /**
   * The whole sentence the Unlock screen states after an Auto-Lock. Written
   * out per choice rather than composed from a duration, because
   * "Locked after immediately in the background" is what composing produces.
   */
  lockedMessage: string;
}

/**
 * The accepted delays, pinned to the type so adding one to `AutoLockDelay`
 * without teaching this table about it fails to compile rather than silently
 * reading back as the default (ADR 0053).
 */
const AUTO_LOCK_DELAYS = {
  immediately: { ms: 0, lockedMessage: 'Locked when you left the app.' },
  '1m': {
    ms: 60_000,
    lockedMessage: 'Locked after 1 minute in the background.',
  },
  '5m': {
    ms: 5 * 60_000,
    lockedMessage: 'Locked after 5 minutes in the background.',
  },
  '15m': {
    ms: 15 * 60_000,
    lockedMessage: 'Locked after 15 minutes in the background.',
  },
} as const satisfies Record<AutoLockDelay, AutoLockDelayMeta>;

/**
 * A stored delay, or the default when the store holds nothing usable —
 * nothing written yet, or a value written by a build that accepted one this
 * one does not.
 */
export function toAutoLockDelay(raw: string | undefined): AutoLockDelay {
  return raw !== undefined &&
    Object.prototype.hasOwnProperty.call(AUTO_LOCK_DELAYS, raw)
    ? (raw as AutoLockDelay)
    : DEFAULT_AUTO_LOCK_DELAY;
}

/** How long this delay allows in the background, in milliseconds. */
export function autoLockDelayMs(delay: AutoLockDelay): number {
  return AUTO_LOCK_DELAYS[delay].ms;
}

/**
 * What the Unlock screen states when an Auto-Lock at this delay is why the
 * Vault is locked. A User who left the app unlocked and came back to a
 * passphrase prompt is owed the reason; without it the lock reads as the app
 * having lost their session.
 */
export function describeAutoLock(delay: AutoLockDelay): string {
  return AUTO_LOCK_DELAYS[delay].lockedMessage;
}
