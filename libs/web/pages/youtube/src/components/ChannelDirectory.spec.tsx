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
  }) => <button {...props}>{children}</button>,
  Skeleton: ({ className }: unknown) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

jest.mock('lucide-react', () => ({
  CheckCircle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  Circle: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  ListPlus: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
  X: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden="true" />
  ),
}));

jest.mock('../hooks', () => ({
  updateVideoWatched: jest.fn(),
}));

let capturedPlayerOnNearEnd: (() => void) | undefined;
jest.mock('./YouTubeVideoPlayer', () => ({
  YouTubeVideoPlayer: ({
    video,
    onNearEnd,
  }: {
    video: { videoId: string; title: string };
    onNearEnd?: () => void;
  }) => {
    capturedPlayerOnNearEnd = onNearEnd;
    return (
      <div data-testid={`player-${video.videoId}`}>
        Video Player: {video.title}
      </div>
    );
  },
}));

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ChannelCarousel, YouTubeVideo } from '../types';
import { updateVideoWatched } from '../hooks';
import { ChannelDirectory } from './ChannelDirectory';

const makeVideo = (
  id: string,
  title: string,
  watched = false,
): YouTubeVideo => ({
  id: `vid-${id}`,
  videoId: `vid-${id}`,
  channelId: 'ch-1',
  title,
  thumbnail: null,
  publishedAt: '2025-01-01T00:00:00Z',
  channelTitle: 'Test Channel',
  watched,
});

const makeChannel = (
  id: string,
  title: string,
  videos: YouTubeVideo[] = [],
): ChannelCarousel => ({
  channelId: id,
  channelTitle: title,
  channelThumbnail: null,
  videos,
});

describe('ChannelDirectory', () => {
  beforeEach(() => {
    capturedPlayerOnNearEnd = undefined;
    jest.clearAllMocks();
  });

  describe('Error state', () => {
    it('shows role="alert" with error text when error prop is set', () => {
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
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('does not show Retry button when error is set but onRetry is not provided', () => {
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

    it('calls onRetry when Retry button is clicked', () => {
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

    it('shows error alert even when loading is true', () => {
      render(
        <ChannelDirectory
          channels={[]}
          loading={true}
          error="Failed to load channels"
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load channels')).toBeInTheDocument();
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows skeleton placeholders with status role when loading is true and channels is empty', () => {
      const { container } = render(
        <ChannelDirectory channels={[]} loading={true} error={null} />,
      );

      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion).toBeInTheDocument();
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty state', () => {
    it('shows "No Enabled Channels yet" message when channels is empty and not loading', () => {
      render(<ChannelDirectory channels={[]} loading={false} error={null} />);

      expect(screen.getByText(/No Enabled Channels yet/)).toBeInTheDocument();
    });
  });

  describe('Channel list rendering and default selection', () => {
    it('selects the first channel by default with no user interaction', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Detail pane should show first channel's title in h2
      const heading = container.querySelector('div.flex-1 h2');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toBe('Channel 1');
    });

    it('marks selected channel button with aria-current="true"', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
      ];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const buttons = screen.getAllByRole('button');
      // First button set is channel buttons - desktop and mobile versions exist
      // Find the first channel button with aria-current="true"
      const selectedButtons = buttons.filter(
        (btn) => btn.getAttribute('aria-current') === 'true',
      );
      expect(selectedButtons.length).toBeGreaterThan(0);
    });

    it('shows upload count and new badge on channel buttons', () => {
      const videos = [
        makeVideo('1', 'Video 1', false),
        makeVideo('2', 'Video 2', false),
        makeVideo('3', 'Video 3', true),
      ];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Desktop aside should show "3 uploads" and "· 2 New"
      const asideNav = container.querySelector('aside nav');
      if (asideNav) {
        const asideText = asideNav.textContent;
        expect(asideText).toContain('3 upload');
        expect(asideText).toContain('2 New');
      }

      // Mobile should show chip with badge
      const mobileNav = container.querySelector('div.lg\\:hidden nav');
      if (mobileNav) {
        const badge = mobileNav.querySelector('[aria-label="2 new"]');
        expect(badge).toBeInTheDocument();
      }
    });
  });

  describe('Keyboard navigation — channel list (desktop)', () => {
    it('ArrowRight moves focus and selection to next desktop channel button', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
        makeChannel('ch-3', 'Channel 3', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Find the desktop aside channel buttons
      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      const desktopNav = aside?.querySelector('nav');
      const desktopButtons = desktopNav
        ? within(desktopNav).getAllByRole('button')
        : [];
      expect(desktopButtons.length).toBe(3);

      // Focus on first button and press ArrowRight
      desktopButtons[0].focus();
      fireEvent.keyDown(desktopButtons[0], { key: 'ArrowRight' });

      // Focus should move to second button
      expect(desktopButtons[1]).toHaveFocus();

      // Second channel should be selected (verify via detail pane h2)
      const detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 2');
    });

    it('ArrowLeft moves focus and selection to previous desktop channel button', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const aside = container.querySelector('aside');
      const desktopNav = aside?.querySelector('nav');
      const desktopButtons = desktopNav
        ? within(desktopNav).getAllByRole('button')
        : [];

      // Start on second button
      desktopButtons[1].focus();
      fireEvent.keyDown(desktopButtons[1], { key: 'ArrowLeft' });

      expect(desktopButtons[0]).toHaveFocus();
      const detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 1');
    });

    it('Home/End on desktop channel button jumps to first/last', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
        makeChannel('ch-3', 'Channel 3', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const aside = container.querySelector('aside');
      const desktopNav = aside?.querySelector('nav');
      const desktopButtons = desktopNav
        ? within(desktopNav).getAllByRole('button')
        : [];

      // Press Home on any button
      desktopButtons[1].focus();
      fireEvent.keyDown(desktopButtons[1], { key: 'Home' });
      expect(desktopButtons[0]).toHaveFocus();
      let detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 1');

      // Press End
      fireEvent.keyDown(desktopButtons[0], { key: 'End' });
      expect(desktopButtons[2]).toHaveFocus();
      detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 3');
    });
  });

  describe('Keyboard navigation — channel list (mobile)', () => {
    it('Arrow/Home/End on mobile channel button targets mobile buttons independently', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
        makeChannel('ch-3', 'Channel 3', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Get mobile channel list - find div with lg:hidden that contains nav
      const mobileDiv = Array.from(container.querySelectorAll('div')).find(
        (div) =>
          div.classList.contains('lg:hidden') &&
          div.querySelector('nav[aria-label="Enabled channels"]'),
      );

      expect(mobileDiv).toBeInTheDocument();
      const mobileNav = mobileDiv?.querySelector('nav');
      const mobileButtons = mobileNav
        ? within(mobileNav).getAllByRole('button')
        : [];
      expect(mobileButtons.length).toBe(3);

      // Focus first mobile button and press ArrowRight
      mobileButtons[0].focus();
      fireEvent.keyDown(mobileButtons[0], { key: 'ArrowRight' });

      // Verify focus is on second mobile button (not desktop)
      expect(mobileButtons[1]).toHaveFocus();
      const detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 2');
    });
  });

  describe('Uploads list — empty and populated', () => {
    it('shows "No uploads for this channel" and YouTube link when channel has no videos', () => {
      const channels = [makeChannel('ch-1', 'Channel 1', [])];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      expect(
        screen.getByText('No uploads for this channel.'),
      ).toBeInTheDocument();

      const youtubeLink = screen.getByRole('link', {
        name: 'Open channel on YouTube',
      });
      expect(youtubeLink).toHaveAttribute(
        'href',
        'https://www.youtube.com/channel/ch-1',
      );
    });

    it('renders one row per video with title, date, and status', () => {
      const videos = [
        makeVideo('1', 'Video 1', false),
        makeVideo('2', 'Video 2', true),
      ];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Check video titles are links
      const videoLinks = screen.getAllByRole('link');
      const watchLinks = videoLinks.filter(
        (link) =>
          link.getAttribute('href')?.includes('youtube.com/watch?v=') || false,
      );
      expect(watchLinks.length).toBe(2);

      // Check status text
      expect(screen.getByText('New')).toBeInTheDocument(); // Video 1 is unwatched
      expect(screen.getByText('Watched')).toBeInTheDocument(); // Video 2 is watched
    });

    it('renders end-of-list disclosure after non-empty uploads list', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      expect(
        screen.getByText(/MyOrganizer stores only recent uploads/),
      ).toBeInTheDocument();

      const youtubeLinks = screen.getAllByRole('link', {
        name: 'Open channel on YouTube',
      });
      expect(youtubeLinks.length).toBe(1); // The one in the end-of-list section
    });
  });

  describe('Keyboard navigation — uploads list', () => {
    it('ArrowDown/ArrowUp on focused video row moves focus to next/previous row', () => {
      const videos = [
        makeVideo('1', 'Video 1'),
        makeVideo('2', 'Video 2'),
        makeVideo('3', 'Video 3'),
      ];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // The videos appear in a div.space-y-2 after the channel title
      const videoContainer = container.querySelector('div.space-y-2');
      expect(videoContainer).toBeTruthy();

      // All divs with tabIndex in the video container should be our rows
      if (videoContainer) {
        const rows = videoContainer.querySelectorAll('div[tabindex]');
        expect(rows.length).toBe(3);

        // Focus on first row
        (rows[0] as HTMLElement).focus();
        fireEvent.keyDown(rows[0], { key: 'ArrowDown' });

        // Second row should have focus
        expect(rows[1]).toHaveFocus();

        // ArrowUp should go back
        fireEvent.keyDown(rows[1], { key: 'ArrowUp' });
        expect(rows[0]).toHaveFocus();
      }
    });

    it('Home/End on video row jumps to first/last', () => {
      const videos = [
        makeVideo('1', 'Video 1'),
        makeVideo('2', 'Video 2'),
        makeVideo('3', 'Video 3'),
      ];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const videoContainer = container.querySelector('div.space-y-2');
      if (videoContainer) {
        const rows = videoContainer.querySelectorAll('div[tabindex]');

        // Press Home from middle row
        (rows[1] as HTMLElement).focus();
        fireEvent.keyDown(rows[1], { key: 'Home' });
        expect(rows[0]).toHaveFocus();

        // Press End
        fireEvent.keyDown(rows[0], { key: 'End' });
        expect(rows[2]).toHaveFocus();
      }
    });
  });

  describe('In-app player (open/close/escape)', () => {
    it('opens YouTubeVideoPlayer when "Play in app" button is clicked', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();
    });

    it('renders "Close player" button when player is open', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      const closeButton = screen.getByRole('button', {
        name: 'Close player',
      });
      expect(closeButton).toBeInTheDocument();
    });

    it('closes player and restores focus to "Play in app" button when "Close player" is clicked', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', {
        name: 'Close player',
      });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('player-vid-1')).not.toBeInTheDocument();
      expect(playButton).toHaveFocus();
    });

    it('closes player when onNearEnd callback is called for unwatched video and calls updateVideoWatched', async () => {
      const onWatchedToggle = jest.fn();
      const videos = [makeVideo('1', 'Video 1', false)];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      (updateVideoWatched as jest.Mock).mockResolvedValue({
        watched: true,
      });

      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          error={null}
          onWatchedToggle={onWatchedToggle}
        />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      expect(capturedPlayerOnNearEnd).toBeDefined();

      // Simulate video near end
      if (capturedPlayerOnNearEnd) {
        capturedPlayerOnNearEnd();
      }

      await waitFor(() => {
        expect(updateVideoWatched).toHaveBeenCalledWith('vid-1', true);
      });

      await waitFor(() => {
        expect(onWatchedToggle).toHaveBeenCalledWith('vid-1', true);
      });
    });

    it('closes player and restores focus to "Play in app" when Escape is pressed on Close button', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', {
        name: 'Close player',
      });
      fireEvent.keyDown(closeButton, { key: 'Escape' });

      expect(screen.queryByTestId('player-vid-1')).not.toBeInTheDocument();
      expect(playButton).toHaveFocus();
    });

    it('closes player and restores focus when Escape is pressed on focused upload row', () => {
      const videos = [makeVideo('1', 'Video 1'), makeVideo('2', 'Video 2')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();

      // Get the first upload row and fire Escape on it
      const videoContainer = container.querySelector('div.space-y-2');
      const rows = videoContainer?.querySelectorAll('div[tabindex]');
      expect(rows?.length).toBe(2);

      if (rows && rows[0]) {
        fireEvent.keyDown(rows[0] as HTMLElement, { key: 'Escape' });
      }

      expect(screen.queryByTestId('player-vid-1')).not.toBeInTheDocument();
      expect(playButton).toHaveFocus();
    });
  });

  describe('Watched/unwatched toggle on upload row', () => {
    it('calls updateVideoWatched and onWatchedToggle when "Mark as watched" is clicked', async () => {
      const onWatchedToggle = jest.fn();
      const videos = [makeVideo('1', 'Video 1', false)];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      (updateVideoWatched as jest.Mock).mockResolvedValue({
        watched: true,
      });

      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          error={null}
          onWatchedToggle={onWatchedToggle}
        />,
      );

      const watchButton = screen.getByRole('button', {
        name: /Mark Video 1 as watched/,
      });
      fireEvent.click(watchButton);

      await waitFor(() => {
        expect(updateVideoWatched).toHaveBeenCalledWith('vid-1', true);
      });

      await waitFor(() => {
        expect(onWatchedToggle).toHaveBeenCalledWith('vid-1', true);
      });

      // Button text should update
      expect(
        screen.getByRole('button', { name: /Mark Video 1 as new/ }),
      ).toBeInTheDocument();
    });

    it('reverts to previous watched state and shows error alert on updateVideoWatched rejection', async () => {
      const videos = [makeVideo('1', 'Video 1', false)];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      (updateVideoWatched as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      const watchButton = screen.getByRole('button', {
        name: /Mark Video 1 as watched/,
      });
      fireEvent.click(watchButton);

      // Wait for the error to appear
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        const errorAlert = alerts.find(
          (alert) => alert.textContent === 'Failed to update status',
        );
        expect(errorAlert).toBeInTheDocument();
      });

      // Status should revert to "New"
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  describe('Add to queue', () => {
    it('does not render add-to-queue button when onAddToQueue is not provided', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      expect(
        screen.queryByRole('button', { name: /Add to queue/ }),
      ).not.toBeInTheDocument();
    });

    it('calls onAddToQueue when "Add to queue" button is clicked', () => {
      const onAddToQueue = jest.fn();
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          error={null}
          onAddToQueue={onAddToQueue}
        />,
      );

      const addButton = screen.getByRole('button', {
        name: /Add Video 1 to queue/,
      });
      fireEvent.click(addButton);

      expect(onAddToQueue).toHaveBeenCalledWith('vid-1');
    });

    it('disables button and shows "Queued" when isQueued returns true', () => {
      const onAddToQueue = jest.fn();
      const isQueued = jest.fn().mockReturnValue(true);
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          error={null}
          onAddToQueue={onAddToQueue}
          isQueued={isQueued}
        />,
      );

      const button = screen.getByRole('button', {
        name: /already queued/,
      });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Queued');
    });

    it('disables button and shows "Queue full" when queueFull is true', () => {
      const onAddToQueue = jest.fn();
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [makeChannel('ch-1', 'Channel 1', videos)];

      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          error={null}
          onAddToQueue={onAddToQueue}
          isQueued={() => false}
          queueFull={true}
        />,
      );

      const button = screen.getByRole('button', { name: /Queue is full/ });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Queue full');
    });
  });

  describe('Channel switching clears player and resets focus', () => {
    it('closes active player and resets selected channel when switching channels', () => {
      const videos = [makeVideo('1', 'Video 1')];
      const channels = [
        makeChannel('ch-1', 'Channel 1', videos),
        makeChannel('ch-2', 'Channel 2', videos),
      ];

      const { container } = render(
        <ChannelDirectory channels={channels} loading={false} error={null} />,
      );

      // Open player on first channel
      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);
      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();

      // Switch to second channel via desktop buttons
      const aside = container.querySelector('aside');
      const desktopNav = aside?.querySelector('nav');
      const desktopButtons = desktopNav
        ? within(desktopNav).getAllByRole('button')
        : [];
      fireEvent.click(desktopButtons[1]);

      // Player should close
      expect(screen.queryByTestId('player-vid-1')).not.toBeInTheDocument();

      // Second channel should be displayed via detail pane h2
      const detailH2 = container.querySelector('div.flex-1 h2');
      expect(detailH2?.textContent).toBe('Channel 2');
    });
  });

  describe('Single active player arbitration', () => {
    const channels = [
      makeChannel('ch-1', 'Channel 1', [makeVideo('1', 'Video 1')]),
    ];

    it('claims playback before opening its own player', () => {
      const onPlaybackClaim = jest.fn();
      render(
        <ChannelDirectory
          channels={channels}
          loading={false}
          onPlaybackClaim={onPlaybackClaim}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: /Play Video 1 in app/ }),
      );

      expect(onPlaybackClaim).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();
    });

    it('closes its player when another surface takes playback', () => {
      const { rerender } = render(
        <ChannelDirectory channels={channels} loading={false} />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: /Play Video 1 in app/ }),
      );
      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();

      rerender(
        <ChannelDirectory
          channels={channels}
          loading={false}
          playbackSuspended
        />,
      );

      expect(screen.queryByTestId('player-vid-1')).not.toBeInTheDocument();
    });

    it('does not steal focus back when it is suspended', () => {
      const { rerender } = render(
        <ChannelDirectory channels={channels} loading={false} />,
      );

      const playButton = screen.getByRole('button', {
        name: /Play Video 1 in app/,
      });
      fireEvent.click(playButton);

      // The surface that claimed playback owns focus placement, so a suspend
      // must not pull focus back to this row's play button.
      (document.activeElement as HTMLElement | null)?.blur();

      rerender(
        <ChannelDirectory
          channels={channels}
          loading={false}
          playbackSuspended
        />,
      );

      expect(document.activeElement).not.toBe(playButton);
    });

    it('still plays normally when no arbitration props are supplied', () => {
      render(<ChannelDirectory channels={channels} loading={false} />);

      fireEvent.click(
        screen.getByRole('button', { name: /Play Video 1 in app/ }),
      );

      expect(screen.getByTestId('player-vid-1')).toBeInTheDocument();
    });
  });
});
