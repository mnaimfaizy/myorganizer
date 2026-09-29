// The Device Settings store: the choices that belong to this installation of
// the app and to nothing else. Never vault data, never synced, never sent
// anywhere — which is exactly why it can be read synchronously and written
// without a network round trip.
import { toAppearance, type Appearance } from './appearance';
import {
  serializeOfferedUserIds,
  toOfferedUserIds,
  withOfferedUserId,
} from './biometricOffer';
import { toAutoLockDelay, type AutoLockDelay } from '../lock/autoLockDelay';
import { readSetting, writeSetting } from './settingsStorage';

/**
 * Every Device Setting, read as one value so a consumer re-renders on any of
 * them rather than subscribing per key.
 *
 * `lastTab` is the route name of the tab the app was last on, held as a plain
 * string: the tab vocabulary belongs to the navigator that owns the tabs, and
 * a name this store accepted before a tab was renamed must not crash the app
 * it is read back into. The navigator validates it.
 *
 * `biometricOfferedUserIds` is the one entry that is not a choice the User
 * made. It records which Users this installation has already offered Biometric
 * Unlock to, so the offer happens once (ADR 0108 decision 1).
 */
export interface DeviceSettings {
  appearance: Appearance;
  lastTab: string | null;
  autoLockDelay: AutoLockDelay;
  biometricOfferedUserIds: readonly string[];
}

const APPEARANCE_KEY = 'appearance';
const LAST_TAB_KEY = 'lastTab';
const AUTO_LOCK_DELAY_KEY = 'autoLockDelay';
const BIOMETRIC_OFFERED_KEY = 'biometricOfferedUserIds';

const listeners = new Set<() => void>();

// Cached rather than re-read per call, because `useSyncExternalStore` compares
// snapshots by identity: a fresh object every read is an infinite render loop.
// The cache is replaced only by a write, which is also what notifies.
let snapshot: DeviceSettings | undefined;

function publish(next: DeviceSettings): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Every Device Setting as it stands now. Stable between writes. */
export function getDeviceSettings(): DeviceSettings {
  snapshot ??= {
    appearance: toAppearance(readSetting(APPEARANCE_KEY)),
    lastTab: readSetting(LAST_TAB_KEY) ?? null,
    autoLockDelay: toAutoLockDelay(readSetting(AUTO_LOCK_DELAY_KEY)),
    biometricOfferedUserIds: toOfferedUserIds(
      readSetting(BIOMETRIC_OFFERED_KEY),
    ),
  };
  return snapshot;
}

/** Record the User's appearance choice for this device. */
export function setAppearance(appearance: Appearance): void {
  writeSetting(APPEARANCE_KEY, appearance);
  publish({ ...getDeviceSettings(), appearance });
}

/** Record the tab the app is on, so the next launch opens there. */
export function setLastTab(lastTab: string): void {
  if (getDeviceSettings().lastTab === lastTab) return;
  writeSetting(LAST_TAB_KEY, lastTab);
  publish({ ...getDeviceSettings(), lastTab });
}

/** Record how long this device may sit in the background before it locks. */
export function setAutoLockDelay(autoLockDelay: AutoLockDelay): void {
  writeSetting(AUTO_LOCK_DELAY_KEY, autoLockDelay);
  publish({ ...getDeviceSettings(), autoLockDelay });
}

/** Whether this installation has already offered this User Biometric Unlock. */
export function hasOfferedBiometricUnlock(userId: string): boolean {
  return getDeviceSettings().biometricOfferedUserIds.includes(userId);
}

/**
 * Record that the offer has been made to this User, whichever way they
 * answered it. Declining and accepting both end the offer: accepting leaves a
 * keystore item that Account turns off, and declining is an answer.
 */
export function markBiometricUnlockOffered(userId: string): void {
  const current = getDeviceSettings().biometricOfferedUserIds;
  const next = withOfferedUserId(current, userId);
  if (next === current) return;
  writeSetting(BIOMETRIC_OFFERED_KEY, serializeOfferedUserIds(next));
  publish({ ...getDeviceSettings(), biometricOfferedUserIds: next });
}

/** Subscribe to Device Setting changes. Returns the unsubscribe. */
export function subscribeToDeviceSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
