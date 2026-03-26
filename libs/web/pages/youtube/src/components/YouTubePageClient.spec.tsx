import { fireEvent, render, screen } from '@testing-library/react';

import { YouTubePageClient } from './YouTubePageClient';

// Mock UI components
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
  Input: (props: any) => <input {...props} />,
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

// Mock hooks
const mockUseYouTubeStatus = jest.fn();
const mockUseYouTubeConnect = jest.fn();
const mockUseYouTubeSubscriptions = jest.fn();
const mockUseYouTubeVideos = jest.fn();
const mockUseYouTubeCarousel = jest.fn();

jest.mock('../hooks', () => ({
  useYouTubeStatus: () => mockUseYouTubeStatus(),
  useYouTubeConnect: () => mockUseYouTubeConnect(),
  useYouTubeSubscriptions: () => mockUseYouTubeSubscriptions(),
  useYouTubeVideos: () => mockUseYouTubeVideos(),
  useYouTubeCarousel: () => mockUseYouTubeCarousel(),
}));

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

  const defaultVideos = {
    videos: [],
    total: 0,
    totalPages: 0,
    loading: false,
    sort: 'latest' as const,
    setSort: jest.fn(),
    search: '',
    setSearch: jest.fn(),
    page: 1,
    setPage: jest.fn(),
  };

  const defaultCarousel = {
    channels: [],
    loading: false,
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseYouTubeConnect.mockReturnValue(defaultConnect);
    mockUseYouTubeSubscriptions.mockReturnValue(defaultSubs);
    mockUseYouTubeVideos.mockReturnValue(defaultVideos);
    mockUseYouTubeCarousel.mockReturnValue(defaultCarousel);
  });

  it('should show loading state', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'loading',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('should show connect prompt when disconnected', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: false,
      status: 'disconnected',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);
    expect(screen.getByText('Connect Your YouTube Account')).toBeTruthy();
    expect(screen.getByText('Connect YouTube')).toBeTruthy();
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
    ).toBeTruthy();
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
    expect(screen.getByText('Subscriptions')).toBeTruthy();
    expect(screen.getByText('Videos')).toBeTruthy();
    expect(screen.getByText('Grid')).toBeTruthy();
    expect(screen.getByText('Carousel')).toBeTruthy();
  });

  it('should toggle between Grid and Carousel views', () => {
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });
    render(<YouTubePageClient />);

    // Default is Grid view, so sort buttons should be visible
    expect(screen.getByText('Latest')).toBeTruthy();

    // Switch to Carousel view
    fireEvent.click(screen.getByText('Carousel'));
    // Carousel has no sort buttons; instead it shows "No videos found."
    expect(screen.getByText('No videos found.')).toBeTruthy();
  });
});
