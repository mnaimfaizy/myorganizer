import { beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
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
  key(): string | null {
    return null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeAll(() => {
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window = {
      localStorage: new MemoryStorage(),
    };
  }
});

describe('cloud backup preferences', () => {
  beforeEach(() => {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window.localStorage.clear();
  });

  test('default load returns empty providers', () => {
    expect(loadCloudBackupPreferences()).toEqual({ providers: {} });
  });

  test('malformed stored data returns empty providers', () => {
    const storage = (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window.localStorage;

    // Test with non-JSON
    storage.setItem(__INTERNAL_CLOUD_PREFERENCES_KEY, '{invalid json}');
    expect(loadCloudBackupPreferences()).toEqual({ providers: {} });

    // Test with array instead of object
    storage.setItem(__INTERNAL_CLOUD_PREFERENCES_KEY, '[]');
    expect(loadCloudBackupPreferences()).toEqual({ providers: {} });

    // Test with null
    storage.setItem(__INTERNAL_CLOUD_PREFERENCES_KEY, 'null');
    expect(loadCloudBackupPreferences()).toEqual({ providers: {} });
  });

  test('save then load roundtrips ageLimit', () => {
    let prefs = loadCloudBackupPreferences();
    prefs = setProviderPrefs(prefs, 'google-drive', { ageLimit: '1-week' });
    saveCloudBackupPreferences(prefs);

    const loaded = loadCloudBackupPreferences();
    expect(getProviderPrefs(loaded, 'google-drive').ageLimit).toBe('1-week');
  });

  test.each([
    ['off', 'off'],
    ['daily', '1-day'],
    ['weekly', '1-week'],
    ['monthly', '1-month'],
  ])(
    'migrates legacy autoInterval %s to ageLimit %s',
    (legacyInterval, expectedLimit) => {
      (
        globalThis as unknown as { window: { localStorage: MemoryStorage } }
      ).window.localStorage.setItem(
        __INTERNAL_CLOUD_PREFERENCES_KEY,
        JSON.stringify({
          providers: { 'google-drive': { autoInterval: legacyInterval } },
        }),
      );
      const loaded = loadCloudBackupPreferences();
      expect(getProviderPrefs(loaded, 'google-drive').ageLimit).toBe(
        expectedLimit,
      );
    },
  );

  test('invalid ageLimit falls back to off', () => {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window.localStorage.setItem(
      __INTERNAL_CLOUD_PREFERENCES_KEY,
      JSON.stringify({
        providers: { 'google-drive': { ageLimit: 'hourly' } },
      }),
    );
    const loaded = loadCloudBackupPreferences();
    expect(getProviderPrefs(loaded, 'google-drive').ageLimit).toBe('off');
  });

  test('invalid legacy autoInterval falls back to off', () => {
    (
      globalThis as unknown as { window: { localStorage: MemoryStorage } }
    ).window.localStorage.setItem(
      __INTERNAL_CLOUD_PREFERENCES_KEY,
      JSON.stringify({
        providers: { 'google-drive': { autoInterval: 'yearly' } },
      }),
    );
    const loaded = loadCloudBackupPreferences();
    expect(getProviderPrefs(loaded, 'google-drive').ageLimit).toBe('off');
  });

  test('setProviderPrefs immutably updates preferences', () => {
    const prefs = loadCloudBackupPreferences();
    const updated = setProviderPrefs(prefs, 'google-drive', {
      ageLimit: '1-day',
    });

    expect(prefs).not.toBe(updated);
    expect(prefs.providers['google-drive']).toBeUndefined();
    expect(updated.providers['google-drive']).toEqual({ ageLimit: '1-day' });
  });

  test('clearProviderPrefs removes the entry and returns new object', () => {
    let prefs = loadCloudBackupPreferences();
    prefs = setProviderPrefs(prefs, 'google-drive', { ageLimit: '1-week' });

    const cleared = clearProviderPrefs(prefs, 'google-drive');
    expect(prefs).not.toBe(cleared);
    expect(cleared.providers['google-drive']).toBeUndefined();
  });

  test('clearProviderPrefs on non-existent entry returns same object', () => {
    const prefs = loadCloudBackupPreferences();
    const cleared = clearProviderPrefs(prefs, 'google-drive');

    expect(cleared).toBe(prefs);
  });

  test('getProviderPrefs returns default off limit when not set', () => {
    const prefs = loadCloudBackupPreferences();
    expect(getProviderPrefs(prefs, 'google-drive')).toEqual({
      ageLimit: 'off',
    });
  });
});
