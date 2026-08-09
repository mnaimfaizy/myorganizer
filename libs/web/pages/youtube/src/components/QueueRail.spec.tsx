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
  ChevronUp: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ChevronDown: ({ className }: { className?: string }) => (
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

  const baseVideo = (id: string, watched = false): YouTubeVideo => ({
    id: `vid-${id}`,
    videoId: id,
    channelId: 'ch-1',
    title: `Test Video ${id}`,
    thumbnail: null,
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched,
  });

  describe('empty state', () => {
    it('should render empty message when queue is empty', () => {
      const library: YouTubeVideo[] = [];
      const { result } = renderHook(() => useVideoQueue(library));
      render(<QueueRail queue={result.current} />);
      expect(screen.getAllByText('Your queue is empty.')).toHaveLength(2); // Desktop and mobile
      expect(
        screen.getAllByText(
          'Add a Cached Upload from a channel row to line up what you want to watch.',
        ),
      ).toHaveLength(2); // Desktop and mobile
    });

    it('should not render Clear button when queue is empty', () => {
      const library: YouTubeVideo[] = [];
      const { result } = renderHook(() => useVideoQueue(library));
      render(<QueueRail queue={result.current} />);
      expect(
        screen.queryByRole('button', { name: 'Clear queue' }),
      ).not.toBeInTheDocument();
    });

    it('should not render aria-current when empty', () => {
      const library: YouTubeVideo[] = [];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container } = render(<QueueRail queue={result.current} />);
      expect(
        container.querySelector('li[aria-current]'),
      ).not.toBeInTheDocument();
    });
  });

  describe('summary and state', () => {
    it('should show "N of 4" summary', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(screen.getAllByText('2 of 4')).toHaveLength(2); // Desktop and mobile
    });

    it('should show aria-live region with polite politeness', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
      });
      rerender(<QueueRail queue={result.current} />);

      const liveRegions = screen.getAllByRole('status');
      // Should have multiple live regions (desktop and mobile)
      liveRegions.forEach((region) => {
        expect(region).toHaveAttribute('aria-live', 'polite');
        expect(region).toHaveAttribute('aria-atomic', 'true');
      });
    });

    it('should announce queue count in aria-live region', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const liveRegions = screen.getAllByRole('status');
      liveRegions.forEach((region) => {
        expect(region).toHaveTextContent('2 Cached Uploads queued');
      });
    });

    it('should show queue full message when at cap', () => {
      const library = Array.from({ length: 4 }, (_, i) =>
        baseVideo(String(i + 1)),
      );
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        for (let i = 1; i <= 4; i++) {
          result.current.add(String(i));
        }
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.getAllByText('Queue is full — 4 is the point.'),
      ).toHaveLength(2); // Desktop and mobile
    });
  });

  describe('queue items rendering', () => {
    it('should render all queued videos', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      // Each video is rendered in both desktop and mobile queue rails
      expect(screen.getAllByText('Test Video 1').length).toBeGreaterThanOrEqual(
        1,
      );
      expect(screen.getAllByText('Test Video 2').length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('should render Play button for each item with correct aria-label', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 1' }).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 2' }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should render Remove button for each item with correct aria-label', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.getAllByRole('button', {
          name: 'Remove Test Video 1 from queue',
        }).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('button', {
          name: 'Remove Test Video 2 from queue',
        }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should render Move up/down buttons with correct aria-labels', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const allButtons = screen.getAllByRole('button');
      const moveUpButtons = allButtons.filter(
        (btn) =>
          btn.getAttribute('aria-label')?.includes('Move') &&
          btn.getAttribute('aria-label')?.includes('up'),
      );
      const moveDownButtons = allButtons.filter(
        (btn) =>
          btn.getAttribute('aria-label')?.includes('Move') &&
          btn.getAttribute('aria-label')?.includes('down'),
      );
      expect(moveUpButtons.length).toBeGreaterThanOrEqual(1);
      expect(moveDownButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('queue operations', () => {
    it('should call queue.playId when Play button clicked', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      act(() => {
        const playBtn = screen.getAllByRole('button', {
          name: 'Play Test Video 2',
        })[0];
        fireEvent.click(playBtn);
      });
      rerender(<QueueRail queue={result.current} />);

      expect(screen.getByTestId('player-2')).toBeInTheDocument();
    });

    it('should call queue.remove when Remove button clicked', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      act(() => {
        const removeBtn = screen.getAllByRole('button', {
          name: 'Remove Test Video 1 from queue',
        })[0];
        fireEvent.click(removeBtn);
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.queryAllByRole('button', { name: 'Play Test Video 1' }),
      ).toHaveLength(0);
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 2' }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should call queue.moveUp when Move up button clicked', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });
      rerender(<QueueRail queue={result.current} />);

      // Verify the initial order
      expect(result.current.ids).toEqual(['1', '2', '3']);

      act(() => {
        const moveUpBtn = screen.getAllByRole('button', {
          name: 'Move Test Video 2 up',
        })[0];
        fireEvent.click(moveUpBtn);
      });
      rerender(<QueueRail queue={result.current} />);

      // After moving up, video 2 should come before video 1
      expect(result.current.ids).toEqual(['2', '1', '3']);
    });

    it('should call queue.moveDown when Move down button clicked', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
      });
      rerender(<QueueRail queue={result.current} />);

      // Verify the initial order
      expect(result.current.ids).toEqual(['1', '2', '3']);

      act(() => {
        const moveDownBtn = screen.getAllByRole('button', {
          name: 'Move Test Video 2 down',
        })[0];
        fireEvent.click(moveDownBtn);
      });
      rerender(<QueueRail queue={result.current} />);

      // After moving down, video 2 should come after video 3
      expect(result.current.ids).toEqual(['1', '3', '2']);
    });

    it('should disable Move up button on first row', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const moveUpButtons = screen.getAllByRole('button', {
        name: 'Move Test Video 1 up',
      });
      expect(moveUpButtons[0]).toBeDisabled();
    });

    it('should disable Move down button on last row', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const moveDownButtons = screen.getAllByRole('button', {
        name: 'Move Test Video 2 down',
      });
      expect(moveDownButtons[0]).toBeDisabled();
    });

    it('should render Clear button when items exist', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.getAllByRole('button', { name: 'Clear queue' }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should call queue.clear when Clear button clicked', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      act(() => {
        const clearBtn = screen.getAllByRole('button', {
          name: 'Clear queue',
        })[0];
        fireEvent.click(clearBtn);
      });
      rerender(<QueueRail queue={result.current} />);

      expect(screen.getAllByText('Your queue is empty.')).toHaveLength(2);
    });
  });

  describe('active item display', () => {
    it('should mark current item with aria-current="true"', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container, rerender } = render(
        <QueueRail queue={result.current} />,
      );

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      // Note: QueueRail renders both desktop and mobile versions, so aria-current appears on one li element
      const items = container.querySelectorAll('li[aria-current="true"]');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveTextContent('Test Video 1');
    });

    it('should show "Now playing" text for current item', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      // Should show "Now playing" text (rendered in both queue rail instances for mobile and desktop)
      expect(screen.getAllByText('Now playing').length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('should display player for current video', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(screen.getByTestId('player-1')).toBeInTheDocument();
    });

    it('should update player when active changes', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);
      expect(screen.getByTestId('player-1')).toBeInTheDocument();

      act(() => {
        result.current.playId('2');
      });
      rerender(<QueueRail queue={result.current} />);
      expect(screen.getByTestId('player-2')).toBeInTheDocument();
      expect(screen.queryByTestId('player-1')).not.toBeInTheDocument();
    });
  });

  describe('focus management', () => {
    it('should move focus to now-playing title when focusSignal increases', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container, rerender } = render(
        <QueueRail queue={result.current} />,
      );

      act(() => {
        result.current.add('1');
      });
      rerender(<QueueRail queue={result.current} />);

      // Before playId, title is not rendered
      let titleElement = container.querySelector('h3[tabindex="-1"]');
      expect(titleElement).toBeNull();

      // Call playId which sets current and bumps focusSignal
      act(() => {
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      // Now the title is rendered
      titleElement = container.querySelector(
        'h3[tabindex="-1"]',
      ) as HTMLHeadingElement;
      expect(titleElement).toBeInTheDocument();
      expect(titleElement?.textContent).toBe('Test Video 1');

      // Focus should move to the title when focusSignal changed
      expect(document.activeElement).toBe(titleElement);
    });

    it('should not move focus on initial render even when current is set', () => {
      const library = [baseVideo('1')];
      const { result } = renderHook(() => useVideoQueue(library));

      // Set up queue with current video BEFORE rendering
      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });

      // Now render the component for the first time with an already-playing queue
      const { container } = render(<QueueRail queue={result.current} />);

      const titleElement = container.querySelector(
        'h3[tabindex="-1"]',
      ) as HTMLHeadingElement;
      expect(titleElement).toBeInTheDocument();
      expect(titleElement?.textContent).toBe('Test Video 1');

      // The ref was initialized to the current focusSignal value, so the effect
      // guard prevents focus movement on initial render
      expect(document.activeElement).not.toBe(titleElement);
      expect(document.activeElement).toBe(document.body);
    });

    it('should not move focus on re-render with unchanged focusSignal', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container, rerender } = render(
        <QueueRail queue={result.current} />,
      );

      act(() => {
        result.current.add('1');
      });
      rerender(<QueueRail queue={result.current} />);

      // Trigger initial focus move
      act(() => {
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      const titleElement = container.querySelector(
        'h3[tabindex="-1"]',
      ) as HTMLHeadingElement;
      expect(titleElement).toBeInTheDocument();
      expect(document.activeElement).toBe(titleElement);

      // Move focus away
      const tempButton = document.createElement('button');
      document.body.appendChild(tempButton);
      act(() => {
        tempButton.focus();
      });
      expect(document.activeElement).toBe(tempButton);

      // Simulate background sync: add another video without changing focusSignal
      act(() => {
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      // Focus should remain on temp button, not pulled back
      expect(document.activeElement).toBe(tempButton);
      expect(document.activeElement).not.toBe(titleElement);

      document.body.removeChild(tempButton);
    });

    it('should not move focus when a background sync replaces the library', () => {
      // This test ensures the focusSignal guard prevents focus theft during sync.
      // A real background sync replaces the library array with new objects
      // (same videoIds, different object identities), which causes libraryById
      // to recompute and queue.current to become a new object. The focus effect's
      // dependency on queue.current triggers, but the focusSignal guard blocks focus.

      const initialLibrary = [baseVideo('1'), baseVideo('2')];

      const { result, rerender: rerenderHook } = renderHook(
        ({ lib }) => useVideoQueue(lib),
        { initialProps: { lib: initialLibrary } },
      );

      const { container, rerender: rerenderComponent } = render(
        <QueueRail queue={result.current} />,
      );

      // Add video and play it
      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });
      rerenderComponent(<QueueRail queue={result.current} />);

      // Verify current is set and focused on the title
      const titleElement = container.querySelector(
        'h3[tabindex="-1"]',
      ) as HTMLHeadingElement;
      expect(titleElement).toBeInTheDocument();
      expect(titleElement?.textContent).toBe('Test Video 1');
      expect(document.activeElement).toBe(titleElement);

      // Save the current video object reference for later comparison
      const originalCurrentVideoObject = result.current.current;
      expect(originalCurrentVideoObject).not.toBeNull();
      expect(originalCurrentVideoObject?.videoId).toBe('1');

      // Verify focusSignal was bumped by playId
      const focusSignalBeforeSync = result.current.focusSignal;
      expect(focusSignalBeforeSync).toBe(1);

      // Move focus away to simulate user interaction elsewhere
      const tempButton = document.createElement('button');
      document.body.appendChild(tempButton);
      act(() => {
        tempButton.focus();
      });
      expect(document.activeElement).toBe(tempButton);

      // Simulate a background sync: replace the library with a new array
      // containing new video objects (same IDs, different identities).
      // This is what happens when YouTubePageClient's channels array updates.
      const syncedLibrary = [baseVideo('1'), baseVideo('2')]; // New objects
      act(() => {
        rerenderHook({ lib: syncedLibrary });
      });

      rerenderComponent(<QueueRail queue={result.current} />);

      // After sync, verify the library was replaced:
      const currentAfterSync = result.current.current;
      expect(currentAfterSync).not.toBeNull();
      expect(currentAfterSync?.videoId).toBe('1');

      // The video object should be different (new object identity from new libraryById)
      expect(currentAfterSync).not.toBe(originalCurrentVideoObject);

      // focusSignal should be unchanged (sync doesn't bump it, only playId does)
      expect(result.current.focusSignal).toBe(focusSignalBeforeSync);

      // The critical assertion: focus was NOT stolen to the title.
      // Without the focusSignal guard, the effect would re-run (because queue.current
      // changed) and would focus the title. With the guard, it stays on temp button.
      expect(document.activeElement).toBe(tempButton);
      expect(document.activeElement).not.toBe(titleElement);

      document.body.removeChild(tempButton);
    });

    it('should not move focus when reordering', () => {
      const library = [baseVideo('1'), baseVideo('2'), baseVideo('3')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container, rerender } = render(
        <QueueRail queue={result.current} />,
      );

      act(() => {
        result.current.add('1');
        result.current.add('2');
        result.current.add('3');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      const titleElement = container.querySelector(
        'h3[tabindex="-1"]',
      ) as HTMLHeadingElement;
      expect(document.activeElement).toBe(titleElement);

      // Move focus away
      const tempButton = document.createElement('button');
      document.body.appendChild(tempButton);
      act(() => {
        tempButton.focus();
      });

      // Reorder (focusSignal doesn't change)
      act(() => {
        result.current.moveUp('2');
      });
      rerender(<QueueRail queue={result.current} />);

      // Focus should stay on temp button
      expect(document.activeElement).toBe(tempButton);

      document.body.removeChild(tempButton);
    });

    it('should handle ArrowDown for keyboard navigation', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      // Both Play buttons should exist
      const playButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-label')?.startsWith('Play'));
      expect(playButtons.length).toBeGreaterThanOrEqual(2);

      // Fire ArrowDown on the first one
      fireEvent.keyDown(playButtons[0], { key: 'ArrowDown' });

      // Both buttons should still be in the document
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 1' }).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 2' }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should handle ArrowUp for keyboard navigation', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const playButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-label')?.startsWith('Play'));
      expect(playButtons.length).toBeGreaterThanOrEqual(2);

      // Fire ArrowUp on the second one
      fireEvent.keyDown(playButtons[1], { key: 'ArrowUp' });

      // Both buttons should still be in the document
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 1' }).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('button', { name: 'Play Test Video 2' }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should clamp keyboard focus at the top', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const btn1Buttons = screen.getAllByRole('button', {
        name: 'Play Test Video 1',
      });
      const btn1 = btn1Buttons[0] as HTMLButtonElement;

      // ArrowUp on the first item should not crash or cause issues
      fireEvent.keyDown(btn1, { key: 'ArrowUp' });
      expect(btn1).toBeInTheDocument();
    });

    it('should clamp keyboard focus at the bottom', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const btn2Buttons = screen.getAllByRole('button', {
        name: 'Play Test Video 2',
      });
      const btn2 = btn2Buttons[0] as HTMLButtonElement;

      // ArrowDown on the last item should not crash or cause issues
      fireEvent.keyDown(btn2, { key: 'ArrowDown' });
      expect(btn2).toBeInTheDocument();
    });
  });

  describe('completion workflow', () => {
    it('should advance to next and persist Watched when completion triggered', async () => {
      const mockUpdate = updateVideoWatched as jest.Mock;
      mockUpdate.mockResolvedValue({ watched: true });
      const onWatchedToggle = jest.fn();

      const library = [baseVideo('A', false), baseVideo('B', false)];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(
        <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
      );

      act(() => {
        result.current.add('A');
        result.current.add('B');
        result.current.playId('A');
      });
      rerender(
        <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
      );

      expect(screen.getByTestId('player-A')).toBeInTheDocument();

      // Trigger near-end for video A
      await act(async () => {
        await capturedPlayerOnNearEnd?.();
      });
      rerender(
        <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
      );

      expect(mockUpdate).toHaveBeenNthCalledWith(1, 'A', true);
      expect(screen.getByTestId('player-B')).toBeInTheDocument();
      expect(screen.queryByTestId('player-A')).not.toBeInTheDocument();
      expect(onWatchedToggle).toHaveBeenNthCalledWith(1, 'A', true);

      // Trigger near-end for video B
      await act(async () => {
        await capturedPlayerOnNearEnd?.();
      });
      rerender(
        <QueueRail queue={result.current} onWatchedToggle={onWatchedToggle} />,
      );

      expect(mockUpdate).toHaveBeenNthCalledWith(2, 'B', true);
      expect(onWatchedToggle).toHaveBeenNthCalledWith(2, 'B', true);
    });

    it('should advance queue even when updateVideoWatched rejects', async () => {
      const mockUpdate = updateVideoWatched as jest.Mock;
      mockUpdate.mockRejectedValue(new Error('Update failed'));

      const library = [baseVideo('A', false), baseVideo('B', false)];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('A');
        result.current.add('B');
        result.current.playId('A');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(screen.getByTestId('player-A')).toBeInTheDocument();

      // Trigger near-end (will fail to update)
      await act(async () => {
        await capturedPlayerOnNearEnd?.();
      });
      rerender(<QueueRail queue={result.current} />);

      expect(mockUpdate).toHaveBeenCalledWith('A', true);
      // Queue should still advance despite the error
      expect(screen.getByTestId('player-B')).toBeInTheDocument();
      expect(screen.queryByTestId('player-A')).not.toBeInTheDocument();
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should render Mark watched & next button', () => {
      const library = [baseVideo('1', false)];
      const { result } = renderHook(() => useVideoQueue(library));
      const { rerender } = render(<QueueRail queue={result.current} />);

      act(() => {
        result.current.add('1');
        result.current.playId('1');
      });
      rerender(<QueueRail queue={result.current} />);

      expect(
        screen.getByRole('button', { name: 'Mark watched & next' }),
      ).toBeInTheDocument();
    });
  });

  describe('responsive layout', () => {
    it('should render mobile disclosure summary with queue count', () => {
      const library = [baseVideo('1'), baseVideo('2')];
      const { result } = renderHook(() => useVideoQueue(library));
      const { container, rerender } = render(
        <QueueRail queue={result.current} />,
      );

      act(() => {
        result.current.add('1');
        result.current.add('2');
      });
      rerender(<QueueRail queue={result.current} />);

      const summary = container.querySelector('summary');
      expect(summary).toBeInTheDocument();
      expect(summary?.textContent).toContain('Queue (2)');
    });
  });
});
