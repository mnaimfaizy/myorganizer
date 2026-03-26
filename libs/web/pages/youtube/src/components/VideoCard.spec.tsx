import { render, screen } from '@testing-library/react';
import { VideoCard } from './VideoCard';

describe('VideoCard', () => {
  const baseVideo = {
    id: '1',
    videoId: 'dQw4w9WgXcQ',
    channelId: 'ch-1',
    title: 'Test Video Title',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
  };

  it('should render the video title', () => {
    render(<VideoCard video={baseVideo} />);
    expect(screen.getByText('Test Video Title')).toBeTruthy();
  });

  it('should render the channel title', () => {
    render(<VideoCard video={baseVideo} />);
    expect(screen.getByText('Test Channel')).toBeTruthy();
  });

  it('should render a link to the YouTube video', () => {
    render(<VideoCard video={baseVideo} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('should render a thumbnail image when provided', () => {
    render(<VideoCard video={baseVideo} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe(baseVideo.thumbnail);
    expect(img.getAttribute('alt')).toBe('Test Video Title');
  });

  it('should render a placeholder when no thumbnail', () => {
    render(<VideoCard video={{ ...baseVideo, thumbnail: null }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('▶')).toBeTruthy();
  });

  it('should format the published date', () => {
    render(<VideoCard video={baseVideo} />);
    // The date should be rendered in some locale format
    const dateEl = screen.getByText(/Dec.*2025|2025.*Dec/i);
    expect(dateEl).toBeTruthy();
  });

  it('should not render channel name dot separator when no channelTitle', () => {
    render(<VideoCard video={{ ...baseVideo, channelTitle: undefined }} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});
