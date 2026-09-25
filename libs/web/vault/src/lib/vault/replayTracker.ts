/**
 * Replay tracker for vault imports.
 *
 * Tracks the last N (default 10) imported `exportId` UUIDs in IndexedDB so we
 * can detect duplicate imports of the same envelope and report them as
 * `replay-detected`.
 *
 * The tracker degrades gracefully:
 * - When IndexedDB is unavailable (Node tests, SSR), it falls back to an
 *   in-memory ring buffer scoped to the module. This is sufficient for tests
 *   and for environments without persistent storage.
 */

const DB_NAME = 'myorganizer_vault_replay_v1';
const STORE_NAME = 'imports';
const DEFAULT_CAPACITY = 10;

export interface ReplayTracker {
  /**
   * Returns true if the given exportId has been seen recently.
   */
  has(exportId: string): Promise<boolean>;
  /**
   * Records the given exportId as seen. Evicts the oldest entry once the
   * configured capacity is exceeded.
   */
  remember(exportId: string): Promise<void>;
}

interface StoredEntry {
  exportId: string;
  ts: number;
}

class InMemoryReplayTracker implements ReplayTracker {
  private readonly buffer: StoredEntry[] = [];

  constructor(private readonly capacity: number) {}

  async has(exportId: string): Promise<boolean> {
    return this.buffer.some((e) => e.exportId === exportId);
  }

  async remember(exportId: string): Promise<void> {
    if (await this.has(exportId)) return;
    this.buffer.push({ exportId, ts: Date.now() });
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }
}

function isIndexedDbAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { indexedDB?: IDBFactory }).indexedDB !==
      'undefined' &&
    (globalThis as { indexedDB?: IDBFactory }).indexedDB !== null
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'exportId' });
        store.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IndexedDbReplayTracker implements ReplayTracker {
  constructor(private readonly capacity: number) {}

  async has(exportId: string): Promise<boolean> {
    const db = await openDb();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(exportId);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  async remember(exportId: string): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Insert (or replace timestamp) for this exportId.
        store.put({ exportId, ts: Date.now() } satisfies StoredEntry);

        // Evict oldest entries until count <= capacity.
        const idx = store.index('ts');
        const cursorReq = idx.openCursor();
        const entries: StoredEntry[] = [];
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            entries.push(cursor.value as StoredEntry);
            cursor.continue();
            return;
          }
          // Sorted ascending by ts; trim from the front.
          const overflow = entries.length - this.capacity;
          for (let i = 0; i < overflow; i += 1) {
            store.delete(entries[i].exportId);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}

/**
 * Returns the default replay tracker for the current environment. Uses
 * IndexedDB in browsers and an in-memory fallback elsewhere.
 */
export function createDefaultReplayTracker(
  capacity: number = DEFAULT_CAPACITY,
): ReplayTracker {
  if (isIndexedDbAvailable()) {
    return new IndexedDbReplayTracker(capacity);
  }
  return new InMemoryReplayTracker(capacity);
}

/** Test-only factory that always uses the in-memory tracker. */
export function createInMemoryReplayTracker(
  capacity: number = DEFAULT_CAPACITY,
): ReplayTracker {
  return new InMemoryReplayTracker(capacity);
}

export const REPLAY_TRACKER_DEFAULT_CAPACITY = DEFAULT_CAPACITY;
