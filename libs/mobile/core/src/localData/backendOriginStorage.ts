// Where the data guard keeps its record, backed by MMKV.
//
// Its own MMKV instance, not the Device Settings one: the record describes
// whose data is on the device, not a choice about the installation, and the
// Device Settings store must stay untouched by everything the guard does.
// Read synchronously, so an unchanged origin costs the first frame nothing.
//
// The web variant beside this file (backendOriginStorage.web.ts) is in-memory.
import { MMKV } from 'react-native-mmkv';
import type {
  BackendOriginRecord,
  BackendOriginStore,
} from './backendOriginGuard';
import { parseUserIds } from './userIds';

const ORIGIN_KEY = 'origin';
const USER_IDS_KEY = 'userIds';

let instance: MMKV | undefined;

/** Constructed on first use rather than at import; see settingsStorage.ts. */
function store(): MMKV {
  instance ??= new MMKV({ id: 'backend-origin' });
  return instance;
}

export const backendOriginStore: BackendOriginStore = {
  read: (): BackendOriginRecord => ({
    origin: store().getString(ORIGIN_KEY) ?? null,
    userIds: parseUserIds(store().getString(USER_IDS_KEY)),
  }),
  write: (record) => {
    if (record.origin === null) store().delete(ORIGIN_KEY);
    else store().set(ORIGIN_KEY, record.origin);
    store().set(USER_IDS_KEY, JSON.stringify(record.userIds));
  },
};
