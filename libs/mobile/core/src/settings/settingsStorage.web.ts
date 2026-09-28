// Web variant of ./settingsStorage, selected by the Vite `resolve.extensions`
// list in apps/mobile/vite.config.mts ('.web.ts' precedes '.ts') and by
// `moduleSuffixes` in apps/mobile/tsconfig.web.json.
//
// MMKV is a JSI module with no react-native-web implementation, so the native
// path cannot be in the web module graph at all. What replaces it is memory,
// not `localStorage`: the web target is the react-native-web preview of this
// app, and a preview that persists an appearance choice the shipped app keeps
// somewhere else is a second source of truth for no gain. A Device Setting is
// per-device by definition, and a browser tab is not the device.
//
// The two paths are interface-compatible and change together: a key written
// here reads back here, which is all the store above promises.
const values = new Map<string, string>();

export function readSetting(key: string): string | undefined {
  return values.get(key);
}

export function writeSetting(key: string, value: string): void {
  values.set(key, value);
}
