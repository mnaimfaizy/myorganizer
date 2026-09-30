import { useEffect, useSyncExternalStore } from 'react';
import {
  getDeviceSettings,
  subscribeToDeviceSettings,
} from '../settings/deviceSettings';
import { keepAwake } from './keepAwake';

function keepScreenAwakeSnapshot(): boolean {
  return getDeviceSettings().keepScreenAwake;
}

/**
 * The "Keep screen awake on a trip" Device Setting, re-rendering the caller
 * when it changes — the Account switch and the Grocery List menu's "Keep
 * screen on" switch are the same setting.
 */
export function useKeepScreenAwakeSetting(): boolean {
  return useSyncExternalStore(
    subscribeToDeviceSettings,
    keepScreenAwakeSnapshot,
  );
}

/**
 * Holds the screen on while `active` is true, and lets it go when `active`
 * turns false or the caller unmounts. A Grocery List on a trip passes
 * "this screen is focused and the setting is on".
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return keepAwake.acquire();
  }, [active]);
}
