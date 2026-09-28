// The Device Settings store: the choices that belong to this installation of
// the app and to nothing else. Never vault data, never synced, never sent
// anywhere — which is exactly why it can be read synchronously and written
// without a network round trip.
import { toAppearance, type Appearance } from './appearance';
import { readSetting, writeSetting } from './settingsStorage';

/**
 * Every Device Setting, read as one value so a consumer re-renders on any of
 * them rather than subscribing per key.
 *
 * `lastTab` is the route name of the tab the app was last on, held as a plain
 * string: the tab vocabulary belongs to the navigator that owns the tabs, and
 * a name this store accepted before a tab was renamed must not crash the app
 * it is read back into. The navigator validates it.
 */
export interface DeviceSettings {
  appearance: Appearance;
  lastTab: string | null;
}

const APPEARANCE_KEY = 'appearance';
const LAST_TAB_KEY = 'lastTab';

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

/** Subscribe to Device Setting changes. Returns the unsubscribe. */
export function subscribeToDeviceSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
