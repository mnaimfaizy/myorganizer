import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  CLOUD_BACKUP_PROVIDER_IDS,
  __INTERNAL_CLOUD_PREFERENCES_KEY,
  clearProviderPrefs,
  getProviderPrefs,
  loadCloudBackupPreferences,
  saveCloudBackupPreferences,
  setProviderPrefs,
} from './preferences';

class MemoryStorage {
  private readonly store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(_index: number): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeAll(() => {
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (globalThis as { window: { localStorage: MemoryStorage } }).window = {
      localStorage: new MemoryStorage(),
    };
  }
});

describe('cloud backup preferences', () => {
  beforeEach(() => {
    (
      globalThis as { window: { localStorage: MemoryStorage } }
    ).window.localStorage.clear();
  });

  test('default load returns empty providers', () => {
    expect(loadCloudBackupPreferences()).toEqual({ providers: {} });
  });

  test('save then load roundtrips provider prefs', () => {
    let prefs = loadCloudBackupPreferences();
    prefs = setProviderPrefs(prefs, 'google-drive', { autoInterval: 'weekly' });
    saveCloudBackupPreferences(prefs);

    const loaded = loadCloudBackupPreferences();
    expect(getProviderPrefs(loaded, 'google-drive').autoInterval).toBe(
      'weekly',
    );
  });

  test('invalid stored autoInterval falls back to off', () => {
    (
      globalThis as { window: { localStorage: MemoryStorage } }
    ).window.localStorage.setItem(
      __INTERNAL_CLOUD_PREFERENCES_KEY,
      JSON.stringify({
        providers: { 'google-drive': { autoInterval: 'yearly' } },
      }),
    );
    const loaded = loadCloudBackupPreferences();
    expect(getProviderPrefs(loaded, 'google-drive').autoInterval).toBe('off');
  });

  test('clearProviderPrefs removes the entry', () => {
    let prefs = loadCloudBackupPreferences();
    prefs = setProviderPrefs(prefs, 'google-drive', { autoInterval: 'daily' });
    prefs = clearProviderPrefs(prefs, 'google-drive');
    expect(prefs.providers['google-drive']).toBeUndefined();
  });

  test('exposes only google-drive in the provider id list', () => {
    expect([...CLOUD_BACKUP_PROVIDER_IDS]).toEqual(['google-drive']);
  });
});
