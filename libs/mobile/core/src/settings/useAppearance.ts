import { useSyncExternalStore } from 'react';
import type { Appearance } from './appearance';
import { getDeviceSettings, subscribeToDeviceSettings } from './deviceSettings';

function appearanceSnapshot(): Appearance {
  return getDeviceSettings().appearance;
}

/**
 * The appearance Device Setting, re-rendering the caller when it changes.
 *
 * Narrowed to the one setting on purpose: the snapshot is a string, so writing
 * the *other* setting — which happens on every tab change — does not re-render
 * the theme boundary. A hook returning the whole settings object would.
 *
 * `useSyncExternalStore` rather than a provider and state, because the store is
 * readable synchronously outside React too: the tab navigator reads the last
 * used tab once, imperatively, to pick its initial route.
 */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribeToDeviceSettings, appearanceSnapshot);
}
