// The native key-value store behind the Device Settings, backed by MMKV.
//
// MMKV is read synchronously, which is the property this store is chosen for:
// the appearance setting and the last used tab are both needed before the
// first frame, and an asynchronous read means either a flash of the wrong
// theme or a splash screen held open to hide one.
//
// The web variant beside this file (settingsStorage.web.ts) is in-memory. See
// its header for why that is the honest implementation there.
import { MMKV } from 'react-native-mmkv';

let instance: MMKV | undefined;

/**
 * Constructed on first read rather than at import, so that importing this
 * module — which a barrel does transitively — does not by itself require the
 * native module to be up.
 */
function store(): MMKV {
  instance ??= new MMKV({ id: 'device-settings' });
  return instance;
}

export function readSetting(key: string): string | undefined {
  return store().getString(key);
}

export function writeSetting(key: string, value: string): void {
  store().set(key, value);
}
