/* eslint-disable import/first */

import '@testing-library/jest-dom';

jest.mock('@myorganizer/web-ui', () => ({
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
  Badge: ({
    children,
    ...props
  }: import('react').HTMLAttributes<HTMLSpanElement> & {
    variant?: string;
  }) => <span {...props}>{children}</span>,
  Button: ({
    children,
    ...props
  }: import('react').ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => <button {...props}>{children}</button>,
}));

jest.mock('lucide-react', () => ({
  CheckCircle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  Circle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  Play: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ListPlus: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
}));

jest.mock('../hooks', () => ({
  updateVideoWatched: jest.fn(),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { updateVideoWatched } from '../hooks';
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

  it('should keep the playing iframe when the player escape link is activated', () => {
    const mockUpdate = updateVideoWatched as jest.Mock;

    render(<VideoCard video={baseVideo} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle('Test Video Title - YouTube video player');
    const playerLink = screen.getByRole('link', { name: /Open on YouTube/ });

    expect(playerLink.getAttribute('href')).toBe(
      `https://www.youtube.com/watch?v=${encodeURIComponent(baseVideo.videoId)}`,
    );
    expect(playerLink.getAttribute('target')).toBe('_blank');
    expect(playerLink.getAttribute('rel')).toContain('noopener');

    fireEvent.click(playerLink);

    expect(screen.getByTitle('Test Video Title - YouTube video player')).toBe(
      iframe,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
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

  it('should persist watched status when playback reaches the near-end threshold', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockResolvedValue({ ok: true, watched: true });
    const onWatchedToggle = jest.fn();

    render(
      <VideoCard
        video={{ ...baseVideo, watched: false }}
        onWatchedToggle={onWatchedToggle}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent('youtube-player-progress', {
          detail: {
            videoId: baseVideo.videoId,
            currentTime: 90,
            duration: 100,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Mark Test Video Title as new/ }),
      ).toBeTruthy();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(baseVideo.videoId, true);
    expect(onWatchedToggle).toHaveBeenCalledWith(baseVideo.videoId, true);
  });

  it('should auto-watch again after marking the video as new', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockImplementation(
      async (_videoId: string, watched: boolean) => ({
        ok: true,
        watched,
      }),
    );

    render(<VideoCard video={{ ...baseVideo, watched: false }} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const dispatchNearEnd = () => {
      act(() => {
        window.dispatchEvent(
          new CustomEvent('youtube-player-progress', {
            detail: {
              videoId: baseVideo.videoId,
              currentTime: 90,
              duration: 100,
            },
          }),
        );
      });
    };

    dispatchNearEnd();

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenNthCalledWith(1, baseVideo.videoId, true);
      expect(
        screen.getByRole('button', { name: /Mark Test Video Title as new/ }),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Mark Test Video Title as new/ }),
    );

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenNthCalledWith(2, baseVideo.videoId, false);
      expect(
        screen.getByRole('button', {
          name: /Mark Test Video Title as watched/,
        }),
      ).toBeTruthy();
      const watchedButton = screen.getByRole('button', {
        name: /Mark Test Video Title as watched/,
      }) as HTMLButtonElement;
      expect(watchedButton.disabled).toBe(false);
    });

    await act(async () => {
      await Promise.resolve();
    });

    dispatchNearEnd();

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenNthCalledWith(3, baseVideo.videoId, true);
    });
  });

  it('should roll back near-end auto-watching and keep title-link navigation side-effect free on failure', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockRejectedValue(new Error('Update failed'));

    render(<VideoCard video={{ ...baseVideo, watched: false }} />);

    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent('youtube-player-progress', {
          detail: {
            videoId: baseVideo.videoId,
            currentTime: 90,
            duration: 100,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Failed to update status',
      );
      expect(
        screen.getByRole('button', {
          name: /Mark Test Video Title as watched/,
        }),
      ).toBeTruthy();
    });

    const titleLink = screen.getByRole('link', { name: baseVideo.title });
    expect(titleLink.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(titleLink.getAttribute('target')).toBe('_blank');
    expect(titleLink.getAttribute('rel')).toContain('noopener');
    fireEvent.click(titleLink);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('should not render add-to-queue button when onAddToQueue is not provided', () => {
    render(<VideoCard video={baseVideo} />);
    expect(
      screen.queryByRole('button', { name: /Add.*to queue/ }),
    ).not.toBeInTheDocument();
  });

  it('should render add-to-queue button when onAddToQueue is provided', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: `Add ${baseVideo.title} to queue` }),
    ).toBeInTheDocument();
  });

  it('should show correct text on add-to-queue button when not queued', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add ${baseVideo.title} to queue`,
    });
    expect(button).toHaveTextContent('Add to queue');
  });

  it('should disable add-to-queue button when isQueued is true', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={true}
      />,
    );
    const button = screen.getByRole('button', {
      name: `${baseVideo.title} is already queued`,
    }) as HTMLButtonElement;
    expect(button).toBeDisabled();
  });

  it('should show "Queued" text when isQueued is true', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={true}
      />,
    );
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('should show correct aria-label when not queued', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add ${baseVideo.title} to queue`,
    });
    expect(button).toHaveAttribute(
      'aria-label',
      `Add ${baseVideo.title} to queue`,
    );
  });

  it('should show correct aria-label when already queued', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={true}
      />,
    );
    const button = screen.getByRole('button', {
      name: `${baseVideo.title} is already queued`,
    });
    expect(button).toHaveAttribute(
      'aria-label',
      `${baseVideo.title} is already queued`,
    );
  });

  it('should call onAddToQueue with videoId when add-to-queue button clicked', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add ${baseVideo.title} to queue`,
    });
    fireEvent.click(button);
    expect(onAddToQueue).toHaveBeenCalledTimes(1);
    expect(onAddToQueue).toHaveBeenCalledWith(baseVideo.videoId);
  });

  it('should not call updateVideoWatched when add-to-queue button clicked', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockResolvedValue({ ok: true, watched: false });
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add ${baseVideo.title} to queue`,
    });
    fireEvent.click(button);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should not toggle watched status when add-to-queue button clicked', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={{ ...baseVideo, watched: false }}
        onAddToQueue={onAddToQueue}
        isQueued={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Add ${baseVideo.title} to queue`,
    });
    fireEvent.click(button);
    expect(
      screen.getByRole('button', {
        name: /Mark.*as watched/,
      }),
    ).toBeInTheDocument();
  });

  it('should disable add-to-queue button when queueFull is true', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
        queueFull={true}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Queue is full — remove an upload to add ${baseVideo.title}`,
    }) as HTMLButtonElement;
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Queue full');
  });

  it('should show correct aria-label when queueFull is true', () => {
    const onAddToQueue = jest.fn();
    render(
      <VideoCard
        video={baseVideo}
        onAddToQueue={onAddToQueue}
        isQueued={false}
        queueFull={true}
      />,
    );
    const button = screen.getByRole('button', {
      name: `Queue is full — remove an upload to add ${baseVideo.title}`,
    });
    expect(button).toBeInTheDocument();
  });
});
