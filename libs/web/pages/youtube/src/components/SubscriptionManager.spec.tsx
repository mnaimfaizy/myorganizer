import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { YouTubeSubscription } from '../types';
import { SubscriptionManager } from './SubscriptionManager';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock @myorganizer/web-ui
jest.mock('@myorganizer/web-ui', () => ({
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
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

const mockSubs: YouTubeSubscription[] = [
  {
    id: 'sub-1',
    channelId: 'ch-1',
    channelTitle: 'Alpha Channel',
    channelThumbnail: 'https://example.com/thumb1.jpg',
    uploadsPlaylistId: 'UU123',
    enabled: true,
    lastSyncedAt: null,
  },
  {
    id: 'sub-2',
    channelId: 'ch-2',
    channelTitle: 'Beta Channel',
    channelThumbnail: null,
    uploadsPlaylistId: 'UU456',
    enabled: false,
    lastSyncedAt: null,
  },
];

describe('SubscriptionManager', () => {
  const defaultProps = {
    subscriptions: mockSubs,
    loading: false,
    onSync: jest.fn(),
    onToggle: jest.fn(),
    onRequestDisconnect: jest.fn(),
  };

  it('should render subscription channel titles', () => {
    render(<SubscriptionManager {...defaultProps} />);
    expect(screen.getByText('Alpha Channel')).toBeTruthy();
    expect(screen.getByText('Beta Channel')).toBeTruthy();
  });

  it('should render refresh channels button', () => {
    render(<SubscriptionManager {...defaultProps} />);
    expect(screen.getByText('Refresh channels')).toBeTruthy();
  });

  it('should render disconnect button', () => {
    render(<SubscriptionManager {...defaultProps} />);
    expect(screen.getByText('Disconnect')).toBeTruthy();
  });

  it('should call onSync when refresh channels button is clicked', () => {
    const onSync = jest.fn();
    render(<SubscriptionManager {...defaultProps} onSync={onSync} />);
    fireEvent.click(screen.getByText('Refresh channels'));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('disables refresh channels and does not call onSync when syncBusy', () => {
    const onSync = jest.fn();
    render(
      <SubscriptionManager {...defaultProps} onSync={onSync} syncBusy={true} />,
    );

    const refreshBtn = screen.getByRole('button', { name: 'Refresh channels' });
    expect(refreshBtn).toBeDisabled();
    fireEvent.click(refreshBtn);
    expect(onSync).not.toHaveBeenCalled();
  });

  it('shows cooldown label on refresh channels when syncRetryAt is in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(<SubscriptionManager {...defaultProps} syncRetryAt={future} />);

    expect(
      screen.getByRole('button', {
        name: /Refresh channels disabled until/i,
      }),
    ).toBeDisabled();
  });

  it('shows Refreshing… while loading', () => {
    render(<SubscriptionManager {...defaultProps} loading={true} />);
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
  });

  it('should call onRequestDisconnect when disconnect button is clicked', () => {
    const onRequestDisconnect = jest.fn();
    render(
      <SubscriptionManager
        {...defaultProps}
        onRequestDisconnect={onRequestDisconnect}
      />,
    );
    fireEvent.click(screen.getByText('Disconnect'));
    expect(onRequestDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should call onToggle when a toggle switch is clicked', () => {
    const onToggle = jest.fn();
    render(<SubscriptionManager {...defaultProps} onToggle={onToggle} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onToggle).toHaveBeenCalledWith('sub-1', false);
  });

  it('should show loading skeletons when loading with no data', () => {
    render(
      <SubscriptionManager
        {...defaultProps}
        subscriptions={[]}
        loading={true}
      />,
    );
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty message when no subscriptions', () => {
    render(<SubscriptionManager {...defaultProps} subscriptions={[]} />);
    expect(screen.getByText(/No subscriptions found/)).toBeTruthy();
  });

  it('should render channel thumbnail for first sub and fallback for second', () => {
    render(<SubscriptionManager {...defaultProps} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/thumb1.jpg');
    // Second sub should have a letter fallback
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('keeps disconnect disabled and does not call onRequestDisconnect when disconnectDisabled', () => {
    const onRequestDisconnect = jest.fn();
    render(
      <SubscriptionManager
        {...defaultProps}
        onRequestDisconnect={onRequestDisconnect}
        disconnectDisabled={true}
        disconnectDisabledReason="Disconnect unavailable while a sync is running"
      />,
    );

    const disconnectBtn = screen.getByRole('button', {
      name: 'Disconnect unavailable while a sync is running',
    });
    expect(disconnectBtn).toBeDisabled();
    fireEvent.click(disconnectBtn);
    expect(onRequestDisconnect).not.toHaveBeenCalled();
  });

  it('should render privacy statement and link to data privacy page', () => {
    render(<SubscriptionManager {...defaultProps} />);
    expect(
      screen.getByText(/Metadata only — never video files/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Watched is yes\/no, not analytics/),
    ).toBeInTheDocument();
    const privacyLink = screen.getByRole('link', {
      name: /How we store your data/i,
    });
    expect(privacyLink).toHaveAttribute('href', '/youtube/data-privacy');
  });
});
