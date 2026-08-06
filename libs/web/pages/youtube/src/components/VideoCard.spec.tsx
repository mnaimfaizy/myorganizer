import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateVideoWatched } from '../hooks';
import { VideoCard } from './VideoCard';

jest.mock('../hooks', () => ({
  updateVideoWatched: jest.fn(),
}));

describe('VideoCard', () => {
  const baseVideo = {
    id: '1',
    videoId: 'dQw4w9WgXcQ',
    channelId: 'ch-1',
    title: 'Test Video Title',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    const links = screen.getAllByRole('link');
    const link = links[0];
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

  it('should toggle watched status when button is clicked', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockResolvedValue({ ok: true, watched: true });
    const onWatchedToggle = jest.fn();

    render(
      <VideoCard
        video={{ ...baseVideo, watched: false }}
        onWatchedToggle={onWatchedToggle}
      />,
    );

    const button = screen.getByRole('button', {
      name: new RegExp(`Mark ${baseVideo.title} as watched`),
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Watched')).toBeTruthy();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith('dQw4w9WgXcQ', true);
    expect(onWatchedToggle).toHaveBeenCalledWith('dQw4w9WgXcQ', true);
  });

  it('should revert state and show error when watched update fails', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockRejectedValue(new Error('Update failed'));

    render(<VideoCard video={{ ...baseVideo, watched: false }} />);

    const button = screen.getByRole('button', {
      name: new RegExp(`Mark ${baseVideo.title} as watched`),
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(screen.getByText('New')).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: new RegExp(`Mark ${baseVideo.title} as watched`),
      }),
    ).toBeTruthy();

    const links = screen.getAllByRole('link');
    const ytLink = links.find(
      (link) =>
        link.getAttribute('href') ===
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(ytLink).toBeDefined();
    if (ytLink) {
      fireEvent.click(ytLink);
    }

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
