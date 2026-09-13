import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

const mockSearchParams = { value: new URLSearchParams() };
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => mockSearchParams.value,
}));

jest.mock('lucide-react', () => ({
  RefreshCw: (props: Record<string, unknown>) => (
    <svg data-testid="refresh-icon" {...props} />
  ),
  // Tone icons rendered by SyncFreshnessIndicator.
  AlertTriangle: (props: Record<string, unknown>) => (
    <svg data-testid="warning-icon" {...props} />
  ),
  CircleAlert: (props: Record<string, unknown>) => (
    <svg data-testid="error-icon" {...props} />
  ),
  Clock: (props: Record<string, unknown>) => (
    <svg data-testid="pending-icon" {...props} />
  ),
  // Icons rendered by ChannelDirectory once the carousel has channels.
  CheckCircle: (props: Record<string, unknown>) => <svg {...props} />,
  Circle: (props: Record<string, unknown>) => <svg {...props} />,
  ExternalLink: (props: Record<string, unknown>) => <svg {...props} />,
  ListPlus: (props: Record<string, unknown>) => <svg {...props} />,
  X: (props: Record<string, unknown>) => <svg {...props} />,
}));

// Mock UI components
jest.mock('@myorganizer/web-ui', () => ({
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  Input: (props: any) => <input {...props} />,
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

// Mock hooks
const mockUseYouTubeStatus = jest.fn();
const mockUseYouTubeConnect = jest.fn();
const mockUseYouTubeSubscriptions = jest.fn();
const mockUseYouTubeCarousel = jest.fn();
const mockUseYouTubeSyncStatus = jest.fn();
const mockUseVideoQueue = jest.fn();
const mockUseChannelUploads = jest.fn();

jest.mock('../hooks', () => ({
  useYouTubeStatus: () => mockUseYouTubeStatus(),
  useYouTubeConnect: () => mockUseYouTubeConnect(),
  useYouTubeSubscriptions: () => mockUseYouTubeSubscriptions(),
  useYouTubeCarousel: () => mockUseYouTubeCarousel(),
  useYouTubeSyncStatus: () => mockUseYouTubeSyncStatus(),
  useVideoQueue: () => mockUseVideoQueue(),
  useChannelUploads: () => mockUseChannelUploads(),
  isRetryCooldownActive: (retryAt?: string | null) =>
    Boolean(retryAt && Date.parse(retryAt) > Date.now()),
  formatRetryAt: (retryAt?: string | null) =>
    retryAt ? new Date(retryAt).toLocaleString() : null,
}));

const { YouTubePageClient } =
  require('./YouTubePageClient') as typeof import('./YouTubePageClient');

describe('YouTubePageClient', () => {
  const defaultConnect = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  const defaultSubs = {
    subscriptions: [],
    loading: false,
    sync: jest.fn(),
    toggle: jest.fn(),
    refresh: jest.fn(),
  };

  const defaultCarousel = {
    channels: [],
    loading: false,
    error: null,
    updateWatched: jest.fn(),
    refresh: jest.fn(),
  };

  const defaultChannelUploads = {
    uploadsByChannel: {},
    loadingChannelIds: new Set<string>(),
    fullyLoadedChannelIds: new Set<string>(),
    error: null,
    loadChannel: jest.fn(),
    updateWatched: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.value = new URLSearchParams();
    mockUseChannelUploads.mockReturnValue(defaultChannelUploads);
    mockUseYouTubeConnect.mockReturnValue(defaultConnect);
    mockUseYouTubeSubscriptions.mockReturnValue(defaultSubs);
    mockUseYouTubeCarousel.mockReturnValue(defaultCarousel);
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerSync: jest.fn(),
      isCooldownActive: false,
      refresh: jest.fn(),
    });
    mockUseVideoQueue.mockReturnValue({
      items: [],
      ids: [],
      activeId: null,
      current: null,
      activeIndex: -1,
      focusSignal: 0,
      isFull: false,
      remainingSlots: 4,
      add: jest.fn(),
      remove: jest.fn(),
      moveUp: jest.fn(),
      moveDown: jest.fn(),
      playId: jest.fn(),
      playNext: jest.fn(),
      completeAndNext: jest.fn(),
      clear: jest.fn(),
      isQueued: jest.fn(),
    });
  });

  it('should show loading state', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'loading',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('should show connect prompt when disconnected', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'disconnected',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(
      screen.getByText('Connect Your YouTube Account'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Connect YouTube' }),
    ).toBeInTheDocument();
  });

  it('should show revoked warning when status is revoked', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'revoked',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(
      screen.getByText(/Your previous connection was revoked/),
    ).toBeInTheDocument();
  });

  it('should call connect when Connect YouTube button clicked', () => {
    const connect = jest.fn();
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'disconnected',
      refresh: jest.fn(),
    });
    mockUseYouTubeConnect.mockReturnValue({
      connect,
      disconnect: jest.fn(),
    });
    render(<YouTubePageClient />);
    fireEvent.click(screen.getByText('Connect YouTube'));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('should show connected dashboard when connected', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
  });

  it('shows last synced when status is available', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    mockUseYouTubeSyncStatus.mockReturnValue({
      status: { lastSyncedAt: '2026-08-06T12:00:00.000Z' },
      loading: false,
      triggerSync: jest.fn(),
      isCooldownActive: false,
      refresh: jest.fn(),
    });

    render(<YouTubePageClient />);
    expect(screen.getByText(/Last synced/)).toHaveTextContent(/Last synced/);
  });

  // Helper to create a sync status with test data
  const statusOf = (
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    status: 'success' as const,
    lastSyncedAt: null,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    retryAt: null,
    ...overrides,
  });

  it('triggers sync without blocking on the response', async () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    // triggerSync never resolves, simulating a stuck connection
    const triggerSync = jest.fn(() => new Promise(() => {}));
    const refresh = jest.fn();

    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerSync,
      isCooldownActive: false,
      refresh,
    });

    render(<YouTubePageClient />);

    // Click the sync button
    const syncBtn = screen.getByRole('button', { name: 'Sync from YouTube' });
    fireEvent.click(syncBtn);

    // Verify triggerSync was called
    expect(triggerSync).toHaveBeenCalled();

    // Verify refresh was called to start polling
    expect(refresh).toHaveBeenCalled();

    // UI should be rendered and responsive (no hang waiting for triggerSync)
    expect(screen.getByText('Videos')).toBeInTheDocument();
  });

  it('shows refresh failed alert when run completes and refresh fails', async () => {
    jest.useFakeTimers();

    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    const syncStatusState: {
      current: Record<string, unknown> | null;
    } = { current: null };
    const syncStatusRefresh = jest.fn();
    const triggerSync = jest.fn();

    mockUseYouTubeSyncStatus.mockImplementation(() => ({
      status: syncStatusState.current,
      loading: false,
      triggerSync,
      isCooldownActive: false,
      refresh: syncStatusRefresh,
    }));

    const subs = {
      ...defaultSubs,
      refresh: jest.fn().mockRejectedValue(new Error('refresh failed')),
    };
    mockUseYouTubeSubscriptions.mockReturnValue(subs);

    const { rerender } = render(<YouTubePageClient />);

    // Transition to running
    syncStatusState.current = statusOf({ status: 'running' });
    act(() => {
      rerender(<YouTubePageClient />);
    });

    // Allow effects to settle and polling to start
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Transition to terminal (success)
    syncStatusState.current = statusOf({ status: 'success' });
    act(() => {
      rerender(<YouTubePageClient />);
    });

    // Allow effects to settle and onRunComplete to fire
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Wait for the alert to appear (subs.refresh rejection triggers alert)
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Refresh failed');

    jest.useRealTimers();
  });

  it('does not surface error when triggerSync rejects', async () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    // triggerSync rejects (504 timeout from long-running connection)
    const triggerSync = jest.fn().mockRejectedValue(new Error('504 timeout'));
    const refresh = jest.fn();

    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerSync,
      isCooldownActive: false,
      refresh,
    });

    render(<YouTubePageClient />);

    // Click sync button
    const syncBtn = screen.getByRole('button', { name: 'Sync from YouTube' });
    await act(async () => {
      fireEvent.click(syncBtn);
      // Let the promise rejection settle
      await Promise.resolve();
    });

    // Verify triggerSync was called
    expect(triggerSync).toHaveBeenCalled();

    // No error alert should appear (rejection is swallowed)
    const alert = screen.queryByRole('alert');
    expect(alert).not.toBeInTheDocument();
  });

  it('disables sync and retry when cooldown is active', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: { retryAt: future },
      loading: false,
      triggerSync: jest.fn(),
      isCooldownActive: true,
      refresh: jest.fn(),
    });

    render(<YouTubePageClient />);

    // Subscription manager sync button should be disabled
    const syncBtn = screen.getByText('Sync from YouTube');
    expect(syncBtn).toBeDisabled();

    // Retry button should be disabled and have a title indicating retry time
    const retryByTitle = screen.queryByTitle(/Retry disabled until/);
    expect(retryByTitle).toBeInTheDocument();
  });

  describe('channel deep link', () => {
    const video = (id: string, title: string) => ({
      id: `row-${id}`,
      videoId: id,
      channelId: 'ch-1',
      title,
      thumbnail: null,
      publishedAt: '2026-01-01T00:00:00Z',
      channelTitle: 'Channel 1',
      watched: false,
    });

    const twoChannels = [
      {
        channelId: 'ch-1',
        channelTitle: 'Channel 1',
        channelThumbnail: null,
        videos: [video('a', 'Upload A')],
      },
      {
        channelId: 'ch-2',
        channelTitle: 'Channel 2',
        channelThumbnail: null,
        videos: [{ ...video('b', 'Upload B'), channelId: 'ch-2' }],
      },
    ];

    beforeEach(() => {
      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });
    });

    it('opens the channel named by ?channel=, so digest mail lands on it', () => {
      mockSearchParams.value = new URLSearchParams('channel=ch-2');
      mockUseYouTubeCarousel.mockReturnValue({
        ...defaultCarousel,
        channels: twoChannels,
      });

      render(<YouTubePageClient />);

      expect(screen.getByText('Upload B')).toBeInTheDocument();
      expect(screen.queryByText('Upload A')).not.toBeInTheDocument();
    });

    it('opens the first channel when no channel is named', () => {
      mockUseYouTubeCarousel.mockReturnValue({
        ...defaultCarousel,
        channels: twoChannels,
      });

      render(<YouTubePageClient />);

      expect(screen.getByText('Upload A')).toBeInTheDocument();
    });

    it('shows an expanded channel its full snapshot rather than the capped slice', () => {
      mockUseYouTubeCarousel.mockReturnValue({
        ...defaultCarousel,
        channels: [twoChannels[0]],
      });
      mockUseChannelUploads.mockReturnValue({
        ...defaultChannelUploads,
        uploadsByChannel: {
          'ch-1': [video('a', 'Upload A'), video('c', 'Older upload C')],
        },
      });

      render(<YouTubePageClient />);

      expect(screen.getByText('Older upload C')).toBeInTheDocument();
    });
  });

  describe('claim-wait polling loop (sync run claim detection)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('polls refreshSync() at 1s intervals until a live status is found', async () => {
      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });

      let callCount = 0;
      const refreshSync = jest.fn(async () => {
        callCount++;
        // First call returns non-live, second returns live
        return callCount === 1
          ? { status: 'never' }
          : { status: 'discovering' };
      });

      const triggerSync = jest.fn().mockResolvedValue(undefined);
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: { status: 'never' },
        loading: false,
        triggerSync,
        isCooldownActive: false,
        refresh: refreshSync,
      });

      render(<YouTubePageClient />);

      // Click sync to start the claim-wait loop
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Sync from YouTube' }),
        );
      });

      // Claim-wait loop calls refreshSync immediately via doPoll()
      expect(refreshSync).toHaveBeenCalledTimes(1);

      // Advance to trigger the second poll at ~1s
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Should have called refreshSync at least twice (initial + second after 1s interval)
      expect(refreshSync).toHaveBeenCalledTimes(2);
    });

    it('stops polling claim-wait loop once a live status is received from refreshSync()', async () => {
      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });

      let callCount = 0;
      const refreshSync = jest.fn(async () => {
        callCount++;
        // Returns live on second call
        return callCount < 2 ? { status: 'never' } : { status: 'discovering' };
      });

      const triggerSync = jest.fn().mockResolvedValue(undefined);
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: { status: 'never' },
        loading: false,
        triggerSync,
        isCooldownActive: false,
        refresh: refreshSync,
      });

      render(<YouTubePageClient />);

      // Click sync to start the claim-wait loop
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Sync from YouTube' }),
        );
      });

      // Advance to trigger polling (using 1s increments to ensure timers fire properly)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should have called twice (initial call + one at 1s, then finds live status and stops)
      expect(refreshSync.mock.calls.length).toBe(2);

      // After finding live status, the claim-wait loop stops scheduling new polls
      // Verify by advancing further and checking call growth
      const callsAfterPolling = refreshSync.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(3000); // Advance another 3s
      });

      // With the claim-wait loop stopped, no more 1s-interval calls should be added
      const newCalls = refreshSync.mock.calls.length - callsAfterPolling;
      expect(newCalls).toBe(0);
    });

    it('stops polling after 30 second deadline without finding a live status', async () => {
      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });

      // Always return non-live
      const refreshSync = jest.fn(async () => ({ status: 'never' }));

      const triggerSync = jest.fn().mockResolvedValue(undefined);
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: { status: 'never' },
        loading: false,
        triggerSync,
        isCooldownActive: false,
        refresh: refreshSync,
      });

      render(<YouTubePageClient />);

      // Click sync to start the claim-wait loop
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Sync from YouTube' }),
        );
      });

      // Advance through the 30s deadline using smaller increments to ensure all timers fire
      for (let i = 0; i < 31; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
      }

      const callsAt31s = refreshSync.mock.calls.length;
      // The claim-wait loop calls refreshSync immediately, then at 1s intervals.
      // With 1s intervals, after 31000ms the loop has executed at t=0, 1, 2, ..., 30
      // That's 31 calls total (then it checks elapsedMs=31000 > 30000 and stops).
      expect(callsAt31s).toBe(31);

      // The claim-wait loop's 1s polling should stop at 30s.
      // After 31s, no more 1s-interval calls should be added from the claim-wait loop.
      await act(async () => {
        jest.advanceTimersByTime(2000); // Advance 2 more seconds
      });

      // In the 2s window after the deadline, we expect no calls from the claim-wait loop
      const newCallsInWindow = refreshSync.mock.calls.length - callsAt31s;
      expect(newCallsInWindow).toBe(0);
    });

    it('does not restart the polling loop when sync is clicked while already waiting', async () => {
      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });

      const refreshSync = jest.fn(async () => ({ status: 'never' }));

      const triggerSync = jest.fn().mockResolvedValue(undefined);
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: { status: 'never' },
        loading: false,
        triggerSync,
        isCooldownActive: false,
        refresh: refreshSync,
      });

      render(<YouTubePageClient />);

      // Click sync the first time
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Sync from YouTube' }),
        );
      });

      // Advance 1.5s in small increments to ensure timers fire properly
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      const callsAfterFirstClick = refreshSync.mock.calls.length;

      // Click again (setWaitingForClaim(true) when already true is a no-op)
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Sync from YouTube' }),
        );
      });

      // Advance another 1.5s
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // After 1.5s: calls at t=0 (initial) and t=1000ms (first scheduled poll) = 2 calls.
      // After another 1.5s (total 3s): call at t=2000ms adds 1 more call.
      // New calls in second 1.5s window: 1 (the t=2000ms call).
      const newCalls = refreshSync.mock.calls.length - callsAfterFirstClick;
      expect(newCalls).toBe(1);

      // At t=3000ms with 1s intervals starting from t=0:
      // calls execute at t=0, t=1000, t=2000 = 3 calls total (not doubled)
      expect(refreshSync.mock.calls.length).toBe(3);
    });
  });
});
