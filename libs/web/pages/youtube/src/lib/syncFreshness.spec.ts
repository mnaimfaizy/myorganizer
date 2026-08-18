import type { YouTubeSyncStatus } from '../types';
import { SYNC_DELAYED_AFTER_MS, describeSyncFreshness } from './syncFreshness';

const NOW = new Date('2026-08-18T12:00:00.000Z');

function statusOf(
  overrides: Partial<YouTubeSyncStatus> = {},
): YouTubeSyncStatus {
  return {
    status: 'success',
    lastSyncedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    lastSyncAttemptAt: null,
    lastSyncError: null,
    retryAt: null,
    ...overrides,
  };
}

describe('describeSyncFreshness', () => {
  describe('while the status is unknown', () => {
    it('reports a pending reading rather than a healthy one', () => {
      const reading = describeSyncFreshness(null, NOW);
      expect(reading.tone).toBe('pending');
      expect(reading.lastSyncedLabel).toBe('Checking sync status…');
      expect(reading.suggestRetry).toBe(false);
    });
  });

  describe('healthy library', () => {
    it('adds no state label to a recent successful sync', () => {
      const reading = describeSyncFreshness(statusOf(), NOW);
      expect(reading.tone).toBe('ok');
      expect(reading.label).toBeNull();
      expect(reading.detail).toBeNull();
      expect(reading.suggestRetry).toBe(false);
    });

    it('still reports when the library was last synced', () => {
      const reading = describeSyncFreshness(statusOf(), NOW);
      expect(reading.lastSyncedLabel).toMatch(/^Last synced /);
    });
  });

  describe('failure states', () => {
    it('reports a fully failed sync and offers Retry', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'failed', lastSyncError: 'syncFailed' }),
        NOW,
      );
      expect(reading.tone).toBe('error');
      expect(reading.label).toBe('Last sync failed');
      expect(reading.detail).toContain('last good snapshot');
      expect(reading.suggestRetry).toBe(true);
    });

    it('reports a partial sync as a warning and offers Retry', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'partial', lastSyncError: 'syncFailed' }),
        NOW,
      );
      expect(reading.tone).toBe('warning');
      expect(reading.label).toBe('Some channels did not sync');
      expect(reading.suggestRetry).toBe(true);
    });

    it('does not offer Retry on a quota stall', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'quota_exceeded', lastSyncError: 'quotaExceeded' }),
        NOW,
      );
      expect(reading.tone).toBe('error');
      expect(reading.label).toContain('quota');
      expect(reading.detail).toContain('cached uploads stay available');
      expect(reading.suggestRetry).toBe(false);
    });

    it('keeps the last synced line on a failure, so the snapshot age stays visible', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'failed' }),
        NOW,
      );
      expect(reading.lastSyncedLabel).toMatch(/^Last synced /);
    });

    it('reports a failure even when the last sync is also stale', () => {
      const reading = describeSyncFreshness(
        statusOf({
          status: 'failed',
          lastSyncedAt: new Date(
            NOW.getTime() - SYNC_DELAYED_AFTER_MS - 1000,
          ).toISOString(),
        }),
        NOW,
      );
      expect(reading.label).toBe('Last sync failed');
    });
  });

  describe('delayed sync', () => {
    it('flags a successful sync older than the threshold', () => {
      const reading = describeSyncFreshness(
        statusOf({
          lastSyncedAt: new Date(
            NOW.getTime() - SYNC_DELAYED_AFTER_MS - 1000,
          ).toISOString(),
        }),
        NOW,
      );
      expect(reading.tone).toBe('warning');
      expect(reading.label).toBe('Sync delayed');
      expect(reading.suggestRetry).toBe(true);
    });

    it('leaves a sync just inside the threshold alone', () => {
      const reading = describeSyncFreshness(
        statusOf({
          lastSyncedAt: new Date(
            NOW.getTime() - SYNC_DELAYED_AFTER_MS + 1000,
          ).toISOString(),
        }),
        NOW,
      );
      expect(reading.tone).toBe('ok');
      expect(reading.label).toBeNull();
    });

    it('applies the delayed check after a manual-refresh cooldown too', () => {
      const reading = describeSyncFreshness(
        statusOf({
          status: 'cooldown',
          lastSyncedAt: new Date(
            NOW.getTime() - SYNC_DELAYED_AFTER_MS - 1000,
          ).toISOString(),
          retryAt: new Date(NOW.getTime() + 60_000).toISOString(),
        }),
        NOW,
      );
      expect(reading.label).toBe('Sync delayed');
    });

    it('does not report a cooldown on a fresh library as a problem', () => {
      const reading = describeSyncFreshness(
        statusOf({
          status: 'cooldown',
          retryAt: new Date(NOW.getTime() + 60_000).toISOString(),
        }),
        NOW,
      );
      expect(reading.tone).toBe('ok');
      expect(reading.label).toBeNull();
    });
  });

  describe('in-flight and first-run states', () => {
    it('reports a running sync without suggesting Retry', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'running' }),
        NOW,
      );
      expect(reading.tone).toBe('pending');
      expect(reading.label).toBe('Syncing…');
      expect(reading.suggestRetry).toBe(false);
    });

    it('explains a never-synced library instead of alarming about it', () => {
      const reading = describeSyncFreshness(
        statusOf({ status: 'never', lastSyncedAt: null }),
        NOW,
      );
      expect(reading.tone).toBe('pending');
      expect(reading.label).toBeNull();
      expect(reading.lastSyncedLabel).toBe('Never synced');
      expect(reading.detail).toContain('Enable a channel');
    });
  });

  describe('malformed timestamps', () => {
    it('falls back to "Never synced" rather than rendering an invalid date', () => {
      const reading = describeSyncFreshness(
        statusOf({ lastSyncedAt: 'not-a-date' }),
        NOW,
      );
      expect(reading.lastSyncedLabel).toBe('Never synced');
    });

    it('does not treat an unparseable timestamp as a delayed sync', () => {
      const reading = describeSyncFreshness(
        statusOf({ lastSyncedAt: 'not-a-date' }),
        NOW,
      );
      expect(reading.label).toBeNull();
    });
  });
});
