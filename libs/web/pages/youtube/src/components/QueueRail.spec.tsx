/* eslint-disable import/first */

import '@testing-library/jest-dom';

jest.mock('@myorganizer/web-ui', () => ({
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
  Button: ({
    children,
    ...props
  }: import('react').ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
    ref?: React.Ref<HTMLButtonElement>;
  }) => <button {...props}>{children}</button>,
}));

jest.mock('lucide-react', () => ({
  Play: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  Trash2: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
}));

jest.mock('../hooks', () => ({
  updateVideoWatched: jest.fn(),
}));

let capturedPlayerOnNearEnd: (() => Promise<void>) | undefined;

jest.mock('./YouTubeVideoPlayer', () => ({
  YouTubeVideoPlayer: ({
    video,
    onNearEnd,
  }: {
    video: any;
    onNearEnd?: () => Promise<void>;
  }) => {
    capturedPlayerOnNearEnd = onNearEnd;
    return (
      <div data-testid={`player-${video.videoId}`}>
        Video Player: {video.title}
      </div>
    );
  },
}));

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
} from '@testing-library/react';
import type { YouTubeVideo } from '../types';
import { useVideoQueue } from '../hooks/useVideoQueue';
import { updateVideoWatched } from '../hooks';
import { QueueRail } from './QueueRail';

describe('QueueRail', () => {
  beforeEach(() => {
    capturedPlayerOnNearEnd = undefined;
    jest.clearAllMocks();
  });

  const baseVideo = (id: string): YouTubeVideo => ({
    id: `vid-${id}`,
    videoId: id,
    channelId: 'ch-1',
    title: `Test Video ${id}`,
    thumbnail: null,
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched: false,
  });

  it('should render empty state when queue is empty', () => {
    const { result } = renderHook(() => useVideoQueue());
    render(<QueueRail queue={result.current} />);
    expect(screen.getByText('Your queue is empty.')).toBeInTheDocument();
  });

  it('should not render Clear queue button when queue is empty', () => {
    const { result } = renderHook(() => useVideoQueue());
    render(<QueueRail queue={result.current} />);
    expect(
      screen.queryByRole('button', { name: 'Clear queue' }),
    ).not.toBeInTheDocument();
  });

  it('should render queue items when videos are queued', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    expect(screen.getByText('Test Video 1')).toBeInTheDocument();
    expect(screen.getByText('Test Video 2')).toBeInTheDocument();
  });

  it('should render Clear queue button when items exist', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
    });
    rerender(<QueueRail queue={result.current} />);
    expect(
      screen.getByRole('button', { name: 'Clear queue' }),
    ).toBeInTheDocument();
  });

  it('should call queue.clear() when Clear queue button is clicked', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
    });
    rerender(<QueueRail queue={result.current} />);
    const clearButton = screen.getByRole('button', { name: 'Clear queue' });
    act(() => {
      fireEvent.click(clearButton);
    });
    rerender(<QueueRail queue={result.current} />);
    expect(screen.getByText('Your queue is empty.')).toBeInTheDocument();
  });

  it('should render aria-live region with polite politeness level', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
    });
    rerender(<QueueRail queue={result.current} />);
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('should show correct count in aria-live region', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('2 Cached Uploads queued');
  });

  it('should display current video in player when playing', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);
    expect(screen.getByTestId('player-1')).toBeInTheDocument();
  });

  it('should render Play and Remove buttons for each queued item', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    expect(
      screen.getByRole('button', { name: 'Play Test Video 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Test Video 1 from queue' }),
    ).toBeInTheDocument();
  });

  it('should call queue.playAt when Play button is clicked', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Play Test Video 2' }),
      );
    });
    rerender(<QueueRail queue={result.current} />);
    expect(screen.getByTestId('player-2')).toBeInTheDocument();
  });

  it('should call queue.remove when Remove button is clicked', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove Test Video 1 from queue' }),
      );
    });
    rerender(<QueueRail queue={result.current} />);
    expect(
      screen.queryByRole('button', { name: 'Play Test Video 1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Play Test Video 2' }),
    ).toBeInTheDocument();
  });

  it('should mark current item with aria-current="true"', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { container, rerender } = render(
      <QueueRail queue={result.current} />,
    );
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);
    const items = container.querySelectorAll('li[aria-current]');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute('aria-current', 'true');
  });

  it('should show "Now playing" text for current item', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);
    const nowPlayingElements = screen.getAllByText('Now playing');
    expect(nowPlayingElements.length).toBeGreaterThan(0);
  });

  it('should handle ArrowDown for keyboard navigation', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    const btn1 = screen.getByRole('button', {
      name: 'Play Test Video 1',
    }) as HTMLButtonElement;
    fireEvent.keyDown(btn1, { key: 'ArrowDown' });
    const btn2 = screen.getByRole('button', {
      name: 'Play Test Video 2',
    }) as HTMLButtonElement;
    expect(btn2).toHaveFocus();
  });

  it('should handle ArrowUp for keyboard navigation', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    const btn2 = screen.getByRole('button', {
      name: 'Play Test Video 2',
    }) as HTMLButtonElement;
    const btn1 = screen.getByRole('button', {
      name: 'Play Test Video 1',
    }) as HTMLButtonElement;
    btn2.focus();
    fireEvent.keyDown(btn2, { key: 'ArrowUp' });
    expect(btn1).toHaveFocus();
  });

  it('should clamp keyboard focus at the top', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    const btn = screen.getByRole('button', {
      name: 'Play Test Video 1',
    }) as HTMLButtonElement;
    btn.focus();
    fireEvent.keyDown(btn, { key: 'ArrowUp' });
    expect(btn).toHaveFocus();
  });

  it('should clamp keyboard focus at the bottom', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);
    const btn = screen.getByRole('button', {
      name: 'Play Test Video 2',
    }) as HTMLButtonElement;
    btn.focus();
    fireEvent.keyDown(btn, { key: 'ArrowDown' });
    expect(btn).toHaveFocus();
  });

  it('should move focus to now-playing title when focusSignal increases', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { container, rerender } = render(
      <QueueRail queue={result.current} />,
    );

    act(() => {
      result.current.add(baseVideo('1'));
    });
    rerender(<QueueRail queue={result.current} />);

    // Before calling playAt, queue.current is null so h3 is not rendered
    let titleElement = container.querySelector('h3[tabindex="-1"]');
    expect(titleElement).toBeNull();

    // Call playAt which sets current (making h3 render) and increments focusSignal
    act(() => {
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);

    // Now the h3 is rendered
    titleElement = container.querySelector(
      'h3[tabindex="-1"]',
    ) as HTMLHeadingElement;
    expect(titleElement).toBeInTheDocument();
    expect(titleElement?.textContent).toBe('Test Video 1');

    // The focus guard should have moved focus to the title when focusSignal changed
    expect(document.activeElement).toBe(titleElement);
  });

  it('should not move focus on initial render even when current is set', () => {
    const { result } = renderHook(() => useVideoQueue());

    // Set up queue with current video and focusSignal incremented BEFORE rendering
    act(() => {
      result.current.add(baseVideo('1'));
      result.current.playAt(0);
    });

    // Now render the component for the first time with an already-playing queue
    const { container } = render(<QueueRail queue={result.current} />);

    const titleElement = container.querySelector(
      'h3[tabindex="-1"]',
    ) as HTMLHeadingElement;
    expect(titleElement).toBeInTheDocument();
    expect(titleElement?.textContent).toBe('Test Video 1');

    // The ref was initialized to the current focusSignal value, so the effect
    // guard (focusSignal !== lastFocusSignalRef.current) is false and focus
    // should not move to the title
    expect(document.activeElement).not.toBe(titleElement);
    expect(document.activeElement).toBe(document.body);
  });

  it('should not move focus on re-render with unchanged focusSignal', () => {
    const { result } = renderHook(() => useVideoQueue());
    const { container, rerender } = render(
      <QueueRail queue={result.current} />,
    );

    act(() => {
      result.current.add(baseVideo('1'));
    });
    rerender(<QueueRail queue={result.current} />);

    // Trigger initial focus move by incrementing focusSignal
    act(() => {
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);

    // Now get the h3 element which is rendered after playAt
    const titleElement = container.querySelector(
      'h3[tabindex="-1"]',
    ) as HTMLHeadingElement;
    expect(titleElement).toBeInTheDocument();

    // After playAt, focus should be on the title
    expect(document.activeElement).toBe(titleElement);

    // Create a temporary button to move focus away from the title
    const tempButton = document.createElement('button');
    document.body.appendChild(tempButton);
    act(() => {
      tempButton.focus();
    });
    expect(document.activeElement).toBe(tempButton);

    // Simulate background sync: add another video (changes queue data)
    // but focusSignal remains the same
    act(() => {
      result.current.add(baseVideo('2'));
    });
    rerender(<QueueRail queue={result.current} />);

    // Since focusSignal didn't change, the effect guard prevents re-focusing.
    // Focus should still be on our temp button, not pulled back to the title.
    expect(document.activeElement).toBe(tempButton);
    expect(document.activeElement).not.toBe(titleElement);

    // Cleanup
    document.body.removeChild(tempButton);
  });

  it('should advance to next upload and persist Watched when onNearEnd triggered for both uploads', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockResolvedValue({ watched: true });
    const onWatchedToggle = jest.fn();

    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(
      <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
    );

    // Add two unwatched videos
    act(() => {
      result.current.add(baseVideo('A'));
      result.current.add(baseVideo('B'));
      result.current.playAt(0);
    });
    rerender(
      <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
    );

    expect(screen.getByTestId('player-A')).toBeInTheDocument();

    // Trigger onNearEnd for video A
    await act(async () => {
      await capturedPlayerOnNearEnd?.();
    });
    rerender(
      <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
    );

    // Assert updateVideoWatched called for A
    expect(mockUpdate).toHaveBeenNthCalledWith(1, 'A', true);

    // Assert queue advanced to B
    expect(screen.getByTestId('player-B')).toBeInTheDocument();
    expect(screen.queryByTestId('player-A')).not.toBeInTheDocument();

    // onWatchedToggle should have been called for A
    expect(onWatchedToggle).toHaveBeenNthCalledWith(1, 'A', true);

    // Trigger onNearEnd for video B
    await act(async () => {
      await capturedPlayerOnNearEnd?.();
    });
    rerender(
      <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
    );

    // Assert updateVideoWatched called for B (this is the critical assertion)
    // Under the old code with watched-value keying, this second call never happened
    expect(mockUpdate).toHaveBeenNthCalledWith(2, 'B', true);

    // onWatchedToggle should have been called for B
    expect(onWatchedToggle).toHaveBeenNthCalledWith(2, 'B', true);
  });

  it('should advance queue even when updateVideoWatched rejects', async () => {
    const mockUpdate = updateVideoWatched as jest.Mock;
    mockUpdate.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useVideoQueue());
    const { rerender } = render(<QueueRail queue={result.current} />);

    // Add two videos
    act(() => {
      result.current.add(baseVideo('A'));
      result.current.add(baseVideo('B'));
      result.current.playAt(0);
    });
    rerender(<QueueRail queue={result.current} />);

    expect(screen.getByTestId('player-A')).toBeInTheDocument();

    // Trigger onNearEnd for video A (which will fail to update)
    await act(async () => {
      await capturedPlayerOnNearEnd?.();
    });
    rerender(<QueueRail queue={result.current} />);

    // Assert updateVideoWatched was called (and failed)
    expect(mockUpdate).toHaveBeenCalledWith('A', true);

    // Assert queue still advanced to B despite the rejection
    expect(screen.getByTestId('player-B')).toBeInTheDocument();
    expect(screen.queryByTestId('player-A')).not.toBeInTheDocument();

    // Should not throw
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
