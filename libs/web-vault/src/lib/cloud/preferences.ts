import { CloudBackupAutoInterval, CloudBackupProviderId } from './types';

const PREFERENCES_KEY = 'myorganizer.cloud-backup.preferences.v1';

export const CLOUD_BACKUP_PROVIDER_IDS: readonly CloudBackupProviderId[] = [
  'google-drive',
] as const;

export const CLOUD_BACKUP_AUTO_INTERVALS: readonly CloudBackupAutoInterval[] = [
  'off',
  'daily',
  'weekly',
  'monthly',
] as const;

/** Default retention: keep N most recent completed backups per provider. */
export const CLOUD_BACKUP_DEFAULT_RETENTION = 10;

/** Stale pending uploads older than this are eligible for cleanup. */
export const CLOUD_BACKUP_STALE_PENDING_MS = 24 * 60 * 60 * 1000; // 24h

export interface CloudBackupProviderPrefs {
  autoInterval: CloudBackupAutoInterval;
}

export interface CloudBackupPreferences {
  providers: Partial<Record<CloudBackupProviderId, CloudBackupProviderPrefs>>;
}

const DEFAULT_PREFS: CloudBackupPreferences = { providers: {} };

function isCloudBackupAutoInterval(
  value: unknown,
): value is CloudBackupAutoInterval {
  return (
    typeof value === 'string' &&
    (CLOUD_BACKUP_AUTO_INTERVALS as readonly string[]).includes(value)
  );
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadCloudBackupPreferences(): CloudBackupPreferences {
  const storage = getStorage();
  if (!storage) return { providers: {} };
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    if (!raw) return { providers: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { providers: {} };
    }
    const providers: CloudBackupPreferences['providers'] = {};
    const candidates = (parsed as { providers?: unknown }).providers;
    if (
      candidates &&
      typeof candidates === 'object' &&
      !Array.isArray(candidates)
    ) {
      for (const id of CLOUD_BACKUP_PROVIDER_IDS) {
        const entry = (candidates as Record<string, unknown>)[id];
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const auto = (entry as Record<string, unknown>).autoInterval;
          providers[id] = {
            autoInterval: isCloudBackupAutoInterval(auto) ? auto : 'off',
          };
        }
      }
    }
    return { providers };
  } catch {
    return { providers: {} };
  }
}

export function saveCloudBackupPreferences(
  prefs: CloudBackupPreferences,
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
}

export function getProviderPrefs(
  prefs: CloudBackupPreferences,
  id: CloudBackupProviderId,
): CloudBackupProviderPrefs {
  return prefs.providers[id] ?? { autoInterval: 'off' };
}

export function setProviderPrefs(
  prefs: CloudBackupPreferences,
  id: CloudBackupProviderId,
  next: CloudBackupProviderPrefs,
): CloudBackupPreferences {
  return {
    ...prefs,
    providers: { ...prefs.providers, [id]: next },
  };
}

export function clearProviderPrefs(
  prefs: CloudBackupPreferences,
  id: CloudBackupProviderId,
): CloudBackupPreferences {
  if (!prefs.providers[id]) return prefs;
  const { [id]: _removed, ...rest } = prefs.providers;
  return { ...prefs, providers: rest };
}

export const __INTERNAL_CLOUD_PREFERENCES_KEY = PREFERENCES_KEY;

export { DEFAULT_PREFS };
