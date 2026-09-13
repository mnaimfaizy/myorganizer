import type { YouTubeSyncStatus, FailingChannelInfo } from '../types';
import { describeSyncProgress, isRunLive, shouldPoll } from './syncProgress';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
const TWO_MINUTES_AGO = new Date(NOW.getTime() - 2 * 60 * 1000).toISOString();

function statusOf(
  overrides: Partial<YouTubeSyncStatus> = {},
): YouTubeSyncStatus {
  return {
    status: 'success',
    lastSyncedAt: HOUR_AGO,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    retryAt: null,
    progress: null,
    ...overrides,
  };
}

function progressOf(overrides: Record<string, unknown> = {}) {
  const base = {
    total: 10,
    processed: 5,
    succeeded: 4,
    failed: 1,
    startedAt: TWO_MINUTES_AGO,
    failedChannels: [] as FailingChannelInfo[],
  };
  return { ...base, ...overrides };
}

describe('describeSyncProgress', () => {
  describe('null or undefined status', () => {
    it.each([null, undefined])(
      'reports pending state with isLive: false and hasSomethingToShow: false when status is %p',
      (status) => {
        const reading = describeSyncProgress(status, NOW);
        expect(reading).toMatchObject({
          phaseLabel: 'Syncing…',
          total: null,
          processed: null,
          percentage: null,
          elapsedLabel: '',
          etaLabel: null,
          isLive: false,
          hasSomethingToShow: false,
          isInterrupted: false,
          failedChannels: [],
        });
      },
    );
  });

  describe('discovering phase', () => {
    it('reports live progress with no counts yet', () => {
      const reading = describeSyncProgress(
        statusOf({ status: 'discovering' }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: 'Finding your channels…',
        total: null,
        processed: null,
        percentage: null,
        elapsedLabel: '',
        etaLabel: null,
        isLive: true,
        hasSomethingToShow: true,
        isInterrupted: false,
        failedChannels: [],
      });
    });
  });

  describe('running phase with progress', () => {
    it('reports live sync with counts and elapsed', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf(),
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: 'Syncing…',
        total: 10,
        processed: 5,
        percentage: 50,
        isLive: true,
        hasSomethingToShow: true,
        isInterrupted: false,
      });
      expect(reading.elapsedLabel).toMatch(/^\d+[ms]/); // "2m" or similar
    });

    it('omits ETA when processed < 5', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ processed: 4 }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });

    it('includes ETA when processed >= 5', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ processed: 5 }),
        }),
        NOW,
      );
      expect(reading.etaLabel).not.toBeNull();
      expect(typeof reading.etaLabel).toBe('string');
    });

    it('calculates percentage with zero total', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ total: 0, processed: 0 }),
        }),
        NOW,
      );
      expect(reading.percentage).toBe(0);
    });

    it('returns null ETA when processed >= total', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ processed: 10, total: 10 }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });
  });

  describe('running phase without progress', () => {
    it('reports isLive: true even without progress data', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: null,
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: 'Syncing…',
        total: null,
        processed: null,
        percentage: null,
        etaLabel: null,
        isLive: true,
        hasSomethingToShow: true,
        isInterrupted: false,
      });
    });

    it('reports isLive: false and hasSomethingToShow: false for terminal states without progress', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'failed',
          progress: null,
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        isLive: false,
        hasSomethingToShow: false,
      });
    });
  });

  describe('success state', () => {
    it('shows nothing on successful sync', () => {
      const reading = describeSyncProgress(
        statusOf({ status: 'success' }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: '',
        total: null,
        processed: null,
        percentage: null,
        isLive: false,
        hasSomethingToShow: false,
      });
    });
  });

  describe('never-synced state', () => {
    it('shows nothing when never synced', () => {
      const reading = describeSyncProgress(statusOf({ status: 'never' }), NOW);
      expect(reading).toMatchObject({
        phaseLabel: '',
        isLive: false,
        hasSomethingToShow: false,
      });
    });
  });

  describe('partial sync (Failing Channels present)', () => {
    it('shows partial results with channels that synced', () => {
      const failedChannel: FailingChannelInfo = {
        channelId: 'ch1',
        channelTitle: 'Test Channel',
        error: 'Access denied',
      };
      const reading = describeSyncProgress(
        statusOf({
          status: 'partial',
          progress: progressOf({
            succeeded: 9,
            failed: 1,
            failedChannels: [failedChannel],
          }),
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: "9 of 10 synced, 1 didn't",
        isLive: false,
        hasSomethingToShow: true,
        isInterrupted: false,
      });
      expect(reading.failedChannels).toEqual([failedChannel]);
    });

    it('uses "synced" label, not "processed", to distinguish succeeded from failed', () => {
      // This catches the defect where "processed of total" would read
      // as "50 of 50" above a failure list, claiming everything succeeded.
      const reading = describeSyncProgress(
        statusOf({
          status: 'partial',
          progress: progressOf({ succeeded: 5, failed: 5 }),
        }),
        NOW,
      );
      expect(reading.phaseLabel).toContain("5 of 10 synced, 5 didn't");
    });

    it('hides the panel on a malformed partial read (progress: null)', () => {
      // Defect 1 (now corrected): the backend returned progress: null on partial status.
      // The contract guarantees progress is non-null on terminal reads, but that guarantee
      // lives across an HTTP boundary and can break silently. This guards the frontend's
      // fallback: with no channels to report, showing an empty panel is worse than showing
      // nothing. Removing this test means the fallback silently breaks if ever regressed.
      const reading = describeSyncProgress(
        statusOf({
          status: 'partial',
          progress: null,
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        isLive: false,
        hasSomethingToShow: false,
      });
    });
  });

  describe('failed sync with syncInterrupted and zero Failing Channels', () => {
    it('shows interrupted sync as a reportable state (core defect from issue #193)', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'failed',
          lastSyncError: 'syncInterrupted',
          progress: progressOf({ failedChannels: [] }),
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: 'Interrupted after 5 of 10',
        isLive: false,
        hasSomethingToShow: true,
        isInterrupted: true,
      });
      // The panel must remain mounted to show this state
      expect(reading.failedChannels).toHaveLength(0);
    });
  });

  describe('failed sync from auth error (no progress or counts)', () => {
    it('hides the panel when there is nothing to report', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'failed',
          progress: null,
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: '',
        isLive: false,
        hasSomethingToShow: false,
      });
    });

    it('still hides the panel even if progress is present but has no Failing Channels', () => {
      // Auth errors before the channel loop do not produce failedChannels
      const reading = describeSyncProgress(
        statusOf({
          status: 'failed',
          lastSyncError: 'authFailed',
          progress: progressOf({ failedChannels: [] }),
        }),
        NOW,
      );
      expect(reading.hasSomethingToShow).toBe(false);
    });
  });

  describe('quota_exceeded state', () => {
    it('shows quota hit with the channel that errored', () => {
      const quotaChannel: FailingChannelInfo = {
        channelId: 'ch-quota',
        channelTitle: 'Quota Channel',
        error: 'Quota exceeded',
      };
      const reading = describeSyncProgress(
        statusOf({
          status: 'quota_exceeded',
          progress: progressOf({ failedChannels: [quotaChannel] }),
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: 'YouTube quota reached',
        isLive: false,
        hasSomethingToShow: true,
      });
      expect(reading.failedChannels).toEqual([quotaChannel]);
    });

    it('shows nothing when quota_exceeded has no progress', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'quota_exceeded',
          progress: null,
        }),
        NOW,
      );
      expect(reading.hasSomethingToShow).toBe(false);
    });
  });

  describe('cooldown state', () => {
    it('shows nothing during cooldown', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'cooldown',
          progress: null,
        }),
        NOW,
      );
      expect(reading).toMatchObject({
        phaseLabel: '',
        isLive: false,
        hasSomethingToShow: false,
      });
    });
  });

  describe('elapsed time formatting', () => {
    it('formats seconds-only when elapsed < 60s', () => {
      const startedAt = new Date(NOW.getTime() - 45 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ startedAt }),
        }),
        NOW,
      );
      expect(reading.elapsedLabel).toBe('45s');
    });

    it('formats minutes and seconds when elapsed >= 60s', () => {
      const startedAt = new Date(
        NOW.getTime() - (2 * 60 + 30) * 1000,
      ).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ startedAt }),
        }),
        NOW,
      );
      expect(reading.elapsedLabel).toBe('2m 30s');
    });

    it('returns empty string when startedAt is in the future', () => {
      const futureStart = new Date(NOW.getTime() + 10 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ startedAt: futureStart }),
        }),
        NOW,
      );
      expect(reading.elapsedLabel).toBe('');
    });

    it('returns empty string for invalid timestamp', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({ startedAt: 'not-a-date' }),
        }),
        NOW,
      );
      expect(reading.elapsedLabel).toBe('');
    });
  });

  describe('ETA formatting and boundaries', () => {
    it('returns null ETA when processed = 4', () => {
      const startedAt = new Date(NOW.getTime() - 10 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 4,
            total: 100,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });

    it('returns ETA string when processed = 5 (boundary)', () => {
      const startedAt = new Date(NOW.getTime() - 50 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 5,
            total: 100,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(typeof reading.etaLabel).toBe('string');
      expect(reading.etaLabel).not.toBeNull();
    });

    it('returns "less than a minute left" for short remaining time', () => {
      const startedAt = new Date(NOW.getTime() - 10 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 100,
            total: 105,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBe('less than a minute left');
    });

    it('returns "about a minute left" for ~1 minute remaining', () => {
      // With processed=5, total=100, elapsedMs=4s:
      // timePerChannel = 4000/5 = 800ms
      // remaining = 95, remainingMs = 95*800 = 76000ms = 76s
      // remainingMinutes = round(76/60) = 1
      const startedAt = new Date(NOW.getTime() - 4 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 5,
            total: 100,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBe('about a minute left');
    });

    it('returns "about N minutes left" for multiple minutes', () => {
      const startedAt = new Date(NOW.getTime() - 60 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 5,
            total: 100,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toMatch(/^about \d+ minutes left$/);
    });

    it('returns null ETA with invalid startedAt timestamp', () => {
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 5,
            total: 100,
            startedAt: 'not-a-date',
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });

    it('returns null ETA when startedAt is in the future (elapsedMs <= 0)', () => {
      const futureStart = new Date(NOW.getTime() + 10 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 5,
            total: 100,
            startedAt: futureStart,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });
  });

  describe('edge case: processed > total', () => {
    it('returns null ETA when processed > total (safeguard against data drift)', () => {
      const startedAt = new Date(NOW.getTime() - 100 * 1000).toISOString();
      const reading = describeSyncProgress(
        statusOf({
          status: 'running',
          progress: progressOf({
            processed: 15,
            total: 10,
            startedAt,
          }),
        }),
        NOW,
      );
      expect(reading.etaLabel).toBeNull();
    });
  });
});

describe('isRunLive', () => {
  it.each<[YouTubeSyncStatus | null | undefined, boolean]>([
    [null, false],
    [undefined, false],
    [statusOf({ status: 'discovering' }), true],
    [statusOf({ status: 'running' }), true],
    [statusOf({ status: 'success' }), false],
    [statusOf({ status: 'partial' }), false],
    [statusOf({ status: 'failed' }), false],
    [statusOf({ status: 'quota_exceeded' }), false],
    [statusOf({ status: 'cooldown' }), false],
    [statusOf({ status: 'never' }), false],
  ])('returns %p for status %p', (status, expected) => {
    expect(isRunLive(status)).toBe(expected);
  });
});

describe('shouldPoll', () => {
  it.each<[YouTubeSyncStatus | null | undefined, boolean]>([
    [null, false],
    [undefined, false],
    [statusOf({ status: 'discovering' }), true],
    [statusOf({ status: 'running' }), true],
    [statusOf({ status: 'success' }), false],
    [statusOf({ status: 'partial' }), false],
    [statusOf({ status: 'failed' }), false],
    [statusOf({ status: 'quota_exceeded' }), false],
    [statusOf({ status: 'cooldown' }), false],
    [statusOf({ status: 'never' }), false],
  ])('returns %p for status %p', (status, expected) => {
    expect(shouldPoll(status)).toBe(expected);
  });
});
