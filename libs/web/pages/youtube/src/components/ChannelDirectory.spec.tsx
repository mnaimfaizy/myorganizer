import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ChannelCarousel } from '../types';
import { ChannelDirectory } from './ChannelDirectory';

// Mock ChannelUploadsRow to isolate ChannelDirectory tests
jest.mock('./ChannelUploadsRow', () => ({
  ChannelUploadsRow: ({ channel, onWatchedToggle }: any) => (
    <div data-testid={`channel-section-${channel.channelId}`}>
      <div data-channel-id={channel.channelId}>{channel.channelTitle}</div>
      {onWatchedToggle && (
        <button
          onClick={() => onWatchedToggle('video-1', true)}
          data-testid={`watched-toggle-${channel.channelId}`}
        >
          Mark watched
        </button>
      )}
    </div>
  ),
}));

// Mock Skeleton component
jest.mock('@myorganizer/web-ui', () => ({
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

const makeChannel = (
  id: string,
  title: string,
  videoCount = 1,
): ChannelCarousel => ({
  channelId: id,
  channelTitle: title,
  channelThumbnail: null,
  videos: Array.from({ length: videoCount }).map((_, i) => ({
    id: `vid-${id}-${i}`,
    videoId: `vid-${id}-${i}`,
    title: `Video ${i + 1}`,
    channelId: id,
    channelTitle: title,
    thumbnail: null,
    publishedAt: '2024-01-01T00:00:00Z',
    watched: false,
  })),
});

describe('ChannelDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show error alert when error is present', () => {
    const onRetry = jest.fn();
    render(
      <ChannelDirectory
        channels={[]}
        loading={false}
        error="Failed to load channels"
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to load channels');
  });

  it('should show error alert without retry button when onRetry is not provided', () => {
    render(
      <ChannelDirectory
        channels={[]}
        loading={false}
        error="Failed to load channels"
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
  });

  it('should call onRetry when Retry button is clicked', () => {
    const onRetry = jest.fn();
    render(
      <ChannelDirectory
        channels={[]}
        loading={false}
        error="Failed to load channels"
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should show error alert even when loading is true', () => {
    render(
      <ChannelDirectory
        channels={[]}
        loading={true}
        error="Failed to load channels"
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load channels')).toBeInTheDocument();
    // Should not show skeletons when error is present
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('should show loading skeletons when loading is true and channels are empty', () => {
    const { container } = render(
      <ChannelDirectory channels={[]} loading={true} error={null} />,
    );

    // Should render 3 skeleton sections
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state message when no channels and not loading', () => {
    render(<ChannelDirectory channels={[]} loading={false} error={null} />);

    expect(screen.getByText(/No Enabled Channels yet/)).toBeInTheDocument();
  });

  it('should render ChannelUploadsRow for each channel', () => {
    const channels = [
      makeChannel('ch-1', 'Channel 1'),
      makeChannel('ch-2', 'Channel 2'),
      makeChannel('ch-3', 'Channel 3'),
    ];

    render(
      <ChannelDirectory channels={channels} loading={false} error={null} />,
    );

    // Check that sections are rendered with correct data-testid
    expect(screen.getByTestId('channel-section-ch-1')).toBeInTheDocument();
    expect(screen.getByTestId('channel-section-ch-2')).toBeInTheDocument();
    expect(screen.getByTestId('channel-section-ch-3')).toBeInTheDocument();

    // Check that channel titles are rendered
    expect(screen.getByText('Channel 1')).toBeInTheDocument();
    expect(screen.getByText('Channel 2')).toBeInTheDocument();
    expect(screen.getByText('Channel 3')).toBeInTheDocument();
  });

  it('should pass onWatchedToggle callback to ChannelUploadsRow', () => {
    const onWatchedToggle = jest.fn();
    const channels = [makeChannel('ch-1', 'Channel 1')];

    render(
      <ChannelDirectory
        channels={channels}
        loading={false}
        error={null}
        onWatchedToggle={onWatchedToggle}
      />,
    );

    const watchedButton = screen.getByTestId('watched-toggle-ch-1');
    fireEvent.click(watchedButton);
    expect(onWatchedToggle).toHaveBeenCalledWith('video-1', true);
  });

  it('should render section elements with aria-labelledby for accessibility', () => {
    const channels = [makeChannel('ch-1', 'Channel 1')];

    const { container } = render(
      <ChannelDirectory channels={channels} loading={false} error={null} />,
    );

    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-labelledby', 'channel-title-ch-1');
  });
});
