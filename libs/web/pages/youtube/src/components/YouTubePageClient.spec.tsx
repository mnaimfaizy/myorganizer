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

  it('shows error after failed refresh and Retry triggers sync', async () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });

    const trigger = jest.fn().mockResolvedValue({ status: 'failed' });
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerSync: trigger,
      isCooldownActive: false,
      refresh: jest.fn(),
    });

    const subs = {
      ...defaultSubs,
      refresh: jest.fn().mockRejectedValue(new Error('refresh failed')),
    };
    mockUseYouTubeSubscriptions.mockReturnValue(subs);

    render(<YouTubePageClient />);

    // Click the subscription sync button
    const syncBtn = screen.getByRole('button', { name: 'Sync from YouTube' });
    expect(syncBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(syncBtn);
    });

    // Wait for the alert to appear
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Refresh failed/);
    expect(trigger).toHaveBeenCalled();
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
});
