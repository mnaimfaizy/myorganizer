import { render, screen } from '@testing-library/react';

import type { ChannelCarousel } from '../types';
import { VideoCarousel } from './VideoCarousel';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

jest.mock('./VideoCard', () => ({
  VideoCard: ({ video }: any) => (
    <div data-testid="video-card">{video.title}</div>
  ),
}));

const mockChannels: ChannelCarousel[] = [
  {
    channelId: 'ch-1',
    channelTitle: 'Alpha Channel',
    channelThumbnail: 'https://example.com/thumb1.jpg',
    videos: [
      {
        id: '1',
        videoId: 'vid-1',
        title: 'Alpha Video 1',
        channelTitle: 'Alpha Channel',
        channelId: 'ch-1',
        thumbnail: 'https://example.com/v1.jpg',
        publishedAt: '2024-01-01T00:00:00Z',
        description: '',
      },
      {
        id: '2',
        videoId: 'vid-2',
        title: 'Alpha Video 2',
        channelTitle: 'Alpha Channel',
        channelId: 'ch-1',
        thumbnail: 'https://example.com/v2.jpg',
        publishedAt: '2024-01-02T00:00:00Z',
        description: '',
      },
    ],
  },
  {
    channelId: 'ch-2',
    channelTitle: 'Beta Channel',
    channelThumbnail: null,
    videos: [
      {
        id: '3',
        videoId: 'vid-3',
        title: 'Beta Video 1',
        channelTitle: 'Beta Channel',
        channelId: 'ch-2',
        thumbnail: null,
        publishedAt: '2024-01-03T00:00:00Z',
        description: '',
      },
    ],
  },
];

describe('VideoCarousel', () => {
  it('should render channel titles', () => {
    render(<VideoCarousel channels={mockChannels} loading={false} />);
    expect(screen.getByText('Alpha Channel')).toBeTruthy();
    expect(screen.getByText('Beta Channel')).toBeTruthy();
  });

  it('should render video cards for each channel', () => {
    render(<VideoCarousel channels={mockChannels} loading={false} />);
    const cards = screen.getAllByTestId('video-card');
    expect(cards).toHaveLength(3);
    expect(screen.getByText('Alpha Video 1')).toBeTruthy();
    expect(screen.getByText('Alpha Video 2')).toBeTruthy();
    expect(screen.getByText('Beta Video 1')).toBeTruthy();
  });

  it('should render channel thumbnail image when available', () => {
    render(<VideoCarousel channels={mockChannels} loading={false} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/thumb1.jpg');
  });

  it('should render letter fallback when no thumbnail', () => {
    render(<VideoCarousel channels={mockChannels} loading={false} />);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('should render scroll buttons with aria labels', () => {
    render(<VideoCarousel channels={mockChannels} loading={false} />);
    const leftBtns = screen.getAllByLabelText('Scroll left');
    const rightBtns = screen.getAllByLabelText('Scroll right');
    expect(leftBtns).toHaveLength(2);
    expect(rightBtns).toHaveLength(2);
  });

  it('should show loading skeletons', () => {
    render(<VideoCarousel channels={[]} loading={true} />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty message when no channels', () => {
    render(<VideoCarousel channels={[]} loading={false} />);
    expect(screen.getByText('No videos found.')).toBeTruthy();
  });
});
