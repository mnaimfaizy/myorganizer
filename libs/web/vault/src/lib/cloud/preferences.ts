import { CloudBackupProviderId, EscapeCopyAgeLimit } from './types';

const PREFERENCES_KEY = 'myorganizer.cloud-backup.preferences.v1';

export const CLOUD_BACKUP_PROVIDER_IDS: readonly CloudBackupProviderId[] = [
  'google-drive',
] as const;

export const ESCAPE_COPY_AGE_LIMITS: readonly EscapeCopyAgeLimit[] = [
  'off',
  '1-day',
  '1-week',
  '1-month',
] as const;

/**
 * Values stored before the setting stopped promising a clock. A device that
 * chose `weekly` keeps a one-week limit; nothing it chose is lost.
 */
const LEGACY_AUTO_INTERVAL_AGE_LIMITS = {
  off: 'off',
  daily: '1-day',
  weekly: '1-week',
  monthly: '1-month',
} as const satisfies Record<string, EscapeCopyAgeLimit>;

/** Default retention: keep N most recent completed backups per provider. */
export const CLOUD_BACKUP_DEFAULT_RETENTION = 10;

/** Stale pending uploads older than this are eligible for cleanup. */
export const CLOUD_BACKUP_STALE_PENDING_MS = 24 * 60 * 60 * 1000; // 24h

export interface CloudBackupProviderPrefs {
  ageLimit: EscapeCopyAgeLimit;
}

export interface CloudBackupPreferences {
  providers: Partial<Record<CloudBackupProviderId, CloudBackupProviderPrefs>>;
}

const DEFAULT_PREFS: CloudBackupPreferences = { providers: {} };

export function isEscapeCopyAgeLimit(
  value: unknown,
): value is EscapeCopyAgeLimit {
  return (
    typeof value === 'string' &&
    (ESCAPE_COPY_AGE_LIMITS as readonly string[]).includes(value)
  );
}

function readAgeLimit(entry: Record<string, unknown>): EscapeCopyAgeLimit {
  if (isEscapeCopyAgeLimit(entry.ageLimit)) return entry.ageLimit;
  const legacy = entry.autoInterval;
  if (
    typeof legacy === 'string' &&
    Object.prototype.hasOwnProperty.call(
      LEGACY_AUTO_INTERVAL_AGE_LIMITS,
      legacy,
    )
  ) {
    return LEGACY_AUTO_INTERVAL_AGE_LIMITS[
      legacy as keyof typeof LEGACY_AUTO_INTERVAL_AGE_LIMITS
    ];
  }
  return 'off';
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
          providers[id] = {
            ageLimit: readAgeLimit(entry as Record<string, unknown>),
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
  return prefs.providers[id] ?? { ageLimit: 'off' };
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
