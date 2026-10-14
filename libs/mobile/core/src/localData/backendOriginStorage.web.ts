// Web variant of ./backendOriginStorage, selected by the Vite
// `resolve.extensions` list in apps/mobile/vite.config.mts and by
// `moduleSuffixes` in apps/mobile/tsconfig.web.json.
//
// In memory, for the reason settingsStorage.web.ts gives: MMKV has no
// react-native-web implementation, and the web preview never ships.
import type {
  BackendOriginRecord,
  BackendOriginStore,
} from './backendOriginGuard';

let record: BackendOriginRecord = { origin: null, userIds: [] };

export const backendOriginStore: BackendOriginStore = {
  read: () => record,
  write: (next) => {
    record = next;
  },
};
