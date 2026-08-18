/* eslint-disable import/first */

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
  AlertCircle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  Play: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { YouTubeVideo } from '../types';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

describe('YouTubeVideoPlayer', () => {
  const baseVideo: YouTubeVideo = {
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

  it('should render a poster without autoplay and use the privacy embed URL after Play', () => {
    render(<YouTubeVideoPlayer video={baseVideo} />);

    expect(screen.getByRole('img', { name: baseVideo.title })).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.queryByTitle(/YouTube video player/)).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle('Test Video Title - YouTube video player');
    expect(iframe.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(iframe);
    expect(iframe.getAttribute('src')).toBe(
      `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        baseVideo.videoId,
      )}?enablejsapi=1&rel=0&modestbranding=1&autoplay=1&origin=${encodeURIComponent(
        window.location.origin,
      )}`,
    );

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
  });

  it('should send the YouTube IFrame API handshake and progress requests to the privacy origin', async () => {
    render(<YouTubeVideoPlayer video={baseVideo} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;
    const iframeWindow = iframe.contentWindow;
    expect(iframeWindow).not.toBeNull();
    if (!iframeWindow) {
      throw new Error('Expected the iframe to have a contentWindow');
    }
    const postMessage = jest.spyOn(iframeWindow, 'postMessage');

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledTimes(7);
    });

    const messages = postMessage.mock.calls.map(([message, targetOrigin]) => [
      JSON.parse(message as string),
      targetOrigin,
    ]);
    const expectedOrigin = 'https://www.youtube-nocookie.com';

    expect(messages).toEqual([
      [{ event: 'listening', id: 1, channel: 'widget' }, expectedOrigin],
      [
        {
          event: 'command',
          func: 'addEventListener',
          args: ['onStateChange'],
          id: 1,
          channel: 'widget',
        },
        expectedOrigin,
      ],
      [
        {
          event: 'command',
          func: 'getCurrentTime',
          args: [],
          id: 1,
          channel: 'widget',
        },
        expectedOrigin,
      ],
      [
        {
          event: 'command',
          func: 'getDuration',
          args: [],
          id: 1,
          channel: 'widget',
        },
        expectedOrigin,
      ],
      [
        {
          event: 'command',
          func: 'getCurrentTime',
          args: [],
          id: 1,
          channel: 'widget',
        },
        expectedOrigin,
      ],
      [
        {
          event: 'command',
          func: 'getDuration',
          args: [],
          id: 1,
          channel: 'widget',
        },
        expectedOrigin,
      ],
      [{ event: 'listening', id: 1, channel: 'widget' }, expectedOrigin],
    ]);
  });

  it('should combine trusted split duration and current-time messages for near-end progress', async () => {
    const onNearEnd = jest.fn();
    render(<YouTubeVideoPlayer video={baseVideo} onNearEnd={onNearEnd} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;
    const iframeWindow = iframe.contentWindow;
    expect(iframeWindow).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframeWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, duration: 100 },
          },
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframeWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, currentTime: 90 },
          },
        }),
      );
    });

    await waitFor(() => {
      expect(onNearEnd).toHaveBeenCalledTimes(1);
    });
  });

  it('should show a safe Open on YouTube fallback after a matching error signal', async () => {
    render(<YouTubeVideoPlayer video={baseVideo} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent('youtube-player-error', {
          detail: {
            videoId: baseVideo.videoId,
            reason: 'Failed to load YouTube video embed.',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Playback unavailable in app')).toBeTruthy();
      expect(
        screen.getByText('Failed to load YouTube video embed.'),
      ).toBeTruthy();
    });

    const fallbackLink = screen.getByRole('link', { name: /Open on YouTube/ });
    expect(fallbackLink.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(fallbackLink.getAttribute('target')).toBe('_blank');
    expect(fallbackLink.getAttribute('rel')).toContain('noopener');
    expect(fallbackLink.getAttribute('rel')).toContain('noreferrer');
  });

  it('should show the trusted iframe message error reason and fallback link', async () => {
    render(<YouTubeVideoPlayer video={baseVideo} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: { event: 'onError', videoId: baseVideo.videoId },
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Embedded playback is restricted for this video.'),
      ).toBeTruthy();
      expect(
        screen.getByRole('link', { name: /Open on YouTube/ }),
      ).toBeTruthy();
    });
  });

  it('should ignore unscoped custom events and untrusted YouTube messages', () => {
    const onNearEnd = jest.fn();
    render(<YouTubeVideoPlayer video={baseVideo} onNearEnd={onNearEnd} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { currentTime: 90, duration: 100 },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: {
          videoId: 'different-video',
          currentTime: 90,
          duration: 100,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('youtube-player-error', {
        detail: { videoId: 'different-video', reason: 'Wrong player' },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        source: window,
        data: { event: 'onError', videoId: baseVideo.videoId },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://www.youtube-nocookie.com',
        source: window,
        data: { event: 'onError', videoId: baseVideo.videoId },
      }),
    );

    expect(onNearEnd).not.toHaveBeenCalled();
    expect(
      screen.getByTitle('Test Video Title - YouTube video player'),
    ).toBeTruthy();
  });

  it('should fire near-end once for percentage and final-seconds thresholds', () => {
    const onNearEnd = jest.fn();
    render(<YouTubeVideoPlayer video={baseVideo} onNearEnd={onNearEnd} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: {
          videoId: baseVideo.videoId,
          currentTime: 89.9,
          duration: 100,
        },
      }),
    );
    expect(onNearEnd).not.toHaveBeenCalled();

    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: baseVideo.videoId, currentTime: 90, duration: 100 },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: baseVideo.videoId, currentTime: 99, duration: 100 },
      }),
    );
    expect(onNearEnd).toHaveBeenCalledTimes(1);

    const secondNearEnd = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={{ ...baseVideo, videoId: 'long-video' }}
        onNearEnd={secondNearEnd}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: 'long-video', currentTime: 369, duration: 400 },
      }),
    );
    expect(secondNearEnd).not.toHaveBeenCalled();
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: 'long-video', currentTime: 370, duration: 400 },
      }),
    );
    expect(secondNearEnd).toHaveBeenCalledTimes(1);
  });

  it('should ignore invalid progress and wait for the short-video threshold', () => {
    const onNearEnd = jest.fn();
    render(<YouTubeVideoPlayer video={baseVideo} onNearEnd={onNearEnd} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const invalidProgress = [
      { currentTime: undefined, duration: 20 },
      { currentTime: Number.NaN, duration: 20 },
      { currentTime: Number.POSITIVE_INFINITY, duration: 20 },
      { currentTime: -1, duration: 20 },
      { currentTime: 20, duration: 0 },
    ];
    for (const progress of invalidProgress) {
      window.dispatchEvent(
        new CustomEvent('youtube-player-progress', {
          detail: { videoId: baseVideo.videoId, ...progress },
        }),
      );
    }
    expect(onNearEnd).not.toHaveBeenCalled();

    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: baseVideo.videoId, currentTime: 17.9, duration: 20 },
      }),
    );
    expect(onNearEnd).not.toHaveBeenCalled();
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: baseVideo.videoId, currentTime: 18, duration: 20 },
      }),
    );
    expect(onNearEnd).toHaveBeenCalledTimes(1);
  });

  it('should not auto-mark an already watched video near the end', () => {
    const onNearEnd = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={{ ...baseVideo, watched: true }}
        watched
        onNearEnd={onNearEnd}
      />,
    );
    expect(screen.getByText('Watched')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );
    window.dispatchEvent(
      new CustomEvent('youtube-player-progress', {
        detail: { videoId: baseVideo.videoId, currentTime: 90, duration: 100 },
      }),
    );

    expect(onNearEnd).not.toHaveBeenCalled();
  });

  it('should fire onPlayingChange(true) when YouTube player state is 1 (playing)', () => {
    const onPlayingChange = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={baseVideo}
        onPlayingChange={onPlayingChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 1 },
          },
        }),
      );
    });

    expect(onPlayingChange).toHaveBeenCalledWith(true);
  });

  it('should fire onPlayingChange(false) when YouTube player state is 0 (ended)', () => {
    const onPlayingChange = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={baseVideo}
        onPlayingChange={onPlayingChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 0 },
          },
        }),
      );
    });

    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });

  it('should fire onPlayingChange(false) when YouTube player state is 2 (paused)', () => {
    const onPlayingChange = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={baseVideo}
        onPlayingChange={onPlayingChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 2 },
          },
        }),
      );
    });

    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });

  it('should not fire onPlayingChange if the callback is not provided', () => {
    // This test ensures that omitting onPlayingChange does not cause errors
    const onPlayingChange = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={baseVideo}
        // onPlayingChange is intentionally omitted
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 1 },
          },
        }),
      );
    });

    // onPlayingChange should not have been called (it was never registered)
    expect(onPlayingChange).not.toHaveBeenCalled();
  });

  it('should only fire onPlayingChange when state transitions, not on repeated state', () => {
    const onPlayingChange = jest.fn();
    render(
      <YouTubeVideoPlayer
        video={baseVideo}
        onPlayingChange={onPlayingChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Play Test Video Title/ }),
    );

    const iframe = screen.getByTitle(
      'Test Video Title - YouTube video player',
    ) as HTMLIFrameElement;

    // First state change to playing
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 1 },
          },
        }),
      );
    });

    expect(onPlayingChange).toHaveBeenCalledTimes(1);
    expect(onPlayingChange).toHaveBeenCalledWith(true);

    // Second state change to playing (no transition)
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 1 },
          },
        }),
      );
    });

    // Should still be 1 call total (no duplicate)
    expect(onPlayingChange).toHaveBeenCalledTimes(1);

    // Now transition to paused
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.youtube-nocookie.com',
          source: iframe.contentWindow,
          data: {
            event: 'infoDelivery',
            info: { videoId: baseVideo.videoId, state: 2 },
          },
        }),
      );
    });

    expect(onPlayingChange).toHaveBeenCalledTimes(2);
    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });
  describe('swapping video on a live instance', () => {
    const otherVideo: YouTubeVideo = {
      ...baseVideo,
      id: '2',
      videoId: 'oHg5SJYRHA0',
      title: 'Second Video Title',
      durationSeconds: 60,
    };

    it('clears a stuck unavailable card when the video is swapped in place', async () => {
      const { rerender } = render(<YouTubeVideoPlayer video={baseVideo} />);
      fireEvent.click(
        screen.getByRole('button', { name: /Play Test Video Title/ }),
      );

      act(() => {
        window.dispatchEvent(
          new CustomEvent('youtube-player-error', {
            detail: { videoId: baseVideo.videoId, reason: 'Blocked.' },
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Playback unavailable in app')).toBeTruthy();
      });

      // The Shorts panel swaps the video without remounting; the previous
      // Short's failure must not condemn the next one.
      rerender(<YouTubeVideoPlayer video={otherVideo} />);

      expect(screen.queryByText('Playback unavailable in app')).toBeNull();
      expect(
        screen.getByTitle('Second Video Title - YouTube video player'),
      ).toBeTruthy();
    });

    it('does not carry the previous duration into the next video near-end check', () => {
      const onNearEnd = jest.fn();
      const { rerender } = render(
        <YouTubeVideoPlayer video={baseVideo} onNearEnd={onNearEnd} />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Play Test Video Title/ }),
      );

      const iframe = screen.getByTitle(
        'Test Video Title - YouTube video player',
      ) as HTMLIFrameElement;

      // The first video is ten minutes long.
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            source: iframe.contentWindow,
            data: {
              event: 'infoDelivery',
              info: { videoId: baseVideo.videoId, duration: 600 },
            },
          }),
        );
      });

      rerender(<YouTubeVideoPlayer video={otherVideo} onNearEnd={onNearEnd} />);

      // The next video reports position but has not reported its own duration
      // yet. Measured against the retained 600s this looks like the final
      // stretch, and the video would be auto-marked Watched nine minutes early.
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            source: iframe.contentWindow,
            data: {
              event: 'infoDelivery',
              info: { videoId: otherVideo.videoId, currentTime: 580 },
            },
          }),
        );
      });

      expect(onNearEnd).not.toHaveBeenCalled();

      // It still fires once the new video reports a duration of its own.
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            source: iframe.contentWindow,
            data: {
              event: 'infoDelivery',
              info: {
                videoId: otherVideo.videoId,
                currentTime: 59,
                duration: 60,
              },
            },
          }),
        );
      });

      expect(onNearEnd).toHaveBeenCalledTimes(1);
    });

    it('reports playing again for the next video after the previous one was playing', () => {
      const onPlayingChange = jest.fn();
      const { rerender } = render(
        <YouTubeVideoPlayer
          video={baseVideo}
          onPlayingChange={onPlayingChange}
        />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: /Play Test Video Title/ }),
      );

      const iframe = screen.getByTitle(
        'Test Video Title - YouTube video player',
      ) as HTMLIFrameElement;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            source: iframe.contentWindow,
            data: {
              event: 'infoDelivery',
              info: { videoId: baseVideo.videoId, state: 1 },
            },
          }),
        );
      });

      expect(onPlayingChange).toHaveBeenLastCalledWith(true);
      onPlayingChange.mockClear();

      rerender(
        <YouTubeVideoPlayer
          video={otherVideo}
          onPlayingChange={onPlayingChange}
        />,
      );

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://www.youtube-nocookie.com',
            source: iframe.contentWindow,
            data: {
              event: 'infoDelivery',
              info: { videoId: otherVideo.videoId, state: 1 },
            },
          }),
        );
      });

      // A retained "already playing" flag would swallow this, leaving the
      // consumer believing nothing is playing.
      expect(onPlayingChange).toHaveBeenCalledWith(true);
    });
  });
});
