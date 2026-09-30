import { useSyncExternalStore } from 'react';
import type { AutoLockDelay } from '../lock/autoLockDelay';
import { getDeviceSettings, subscribeToDeviceSettings } from './deviceSettings';

function autoLockDelaySnapshot(): AutoLockDelay {
  return getDeviceSettings().autoLockDelay;
}

/**
 * The Auto-Lock Delay Device Setting, re-rendering the caller when it changes.
 *
 * Narrowed to the one setting for the reason `useAppearance` is: the snapshot
 * is a string, so writing the *other* settings — which happens on every tab
 * change — does not re-render whatever is watching the lock.
 */
export function useAutoLockDelay(): AutoLockDelay {
  return useSyncExternalStore(subscribeToDeviceSettings, autoLockDelaySnapshot);
}
