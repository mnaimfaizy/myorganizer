/* eslint-disable import/first */
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../hooks', () => ({
  useShortsBudget: jest.fn(),
  useYouTubeShorts: jest.fn(),
  useYouTubeStatus: jest.fn(),
  updateVideoWatched: jest.fn(),
}));

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, asChild, ...props }: any) => {
    if (asChild) return children;
    return <button {...props}>{children}</button>;
  },
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock ShortsPlayerPanel with a simple div so we can confirm it renders in the
// unlocked branch, plus buttons standing in for each playback signal the real
// panel forwards: the Play press, an embed state report, and an embed refusal.
jest.mock('./ShortsPlayerPanel', () => ({
  ShortsPlayerPanel: ({
    activeShort,
    onPlaybackStart,
    onPlayingChange,
    onPlaybackUnavailable,
  }: any) => (
    <div data-testid="player-panel">
      {activeShort ? activeShort.title : 'No short'}
      <button data-testid="press-play" onClick={() => onPlaybackStart?.()}>
        press play
      </button>
      <button
        data-testid="report-playing"
        onClick={() => onPlayingChange?.(true)}
      >
        report playing
      </button>
      <button
        data-testid="report-paused"
        onClick={() => onPlayingChange?.(false)}
      >
        report paused
      </button>
      <button
        data-testid="report-unavailable"
        onClick={() => onPlaybackUnavailable?.()}
      >
        report unavailable
      </button>
    </div>
  ),
}));

// Mock ShortsList so we can confirm it renders in unlocked branch
jest.mock('./ShortsList', () => ({
  ShortsList: ({ shorts, onSelectShort }: any) => (
    <div data-testid="shorts-list">
      <p>All Shorts</p>
      {shorts.map((s: any) => (
        <button
          key={s.videoId}
          data-testid={`short-${s.videoId}`}
          onClick={() => onSelectShort?.(s.videoId)}
        >
          {s.title}
        </button>
      ))}
    </div>
  ),
}));

// Mock ShortsEntryWarning with a clickable button so the gate can open
jest.mock('./ShortsEntryWarning', () => ({
  ShortsEntryWarning: ({ onContinue }: any) => (
    <button data-testid="entry-continue" onClick={onContinue}>
      Continue to Shorts
    </button>
  ),
}));

jest.mock('./ShortsBudgetMeter', () => ({
  ShortsBudgetMeter: () => <div data-testid="meter">Meter</div>,
}));

// Do NOT mock ShortsHardStop — render the real component so link-scan assertions
// catch any youtube.com hrefs in the actual implementation
// jest.mock('./ShortsHardStop', ...);

import { render, screen, fireEvent } from '@testing-library/react';
import { useShortsBudget, useYouTubeShorts, useYouTubeStatus } from '../hooks';
import { ShortsPageClient } from './ShortsPageClient';

describe('ShortsPageClient — locked and unlocked branches', () => {
  const mockShort = {
    id: 'short-1',
    videoId: 'dQw4w9WgXcQ',
    channelId: 'ch-1',
    title: 'Test Short',
    thumbnail: 'https://example.com/thumb.jpg',
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Test Channel',
    watched: false,
  };

  const mockShort2 = {
    id: 'short-2',
    videoId: 'video2',
    channelId: 'ch-2',
    title: 'Another Short',
    thumbnail: 'https://example.com/thumb2.jpg',
    publishedAt: '2025-12-02T00:00:00Z',
    channelTitle: 'Another Channel',
    watched: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useYouTubeStatus as jest.Mock).mockReturnValue({
      connected: true,
      status: 'ready',
    });
  });

  describe('locked branch — Hard Stop blocks player and list', () => {
    it('renders Hard Stop surface with no player, no navigation, no list when locked after acknowledging', () => {
      (useShortsBudget as jest.Mock).mockReturnValue({
        spentMs: 3600000,
        limitMs: 3600000,
        remainingMs: 0,
        usedPercent: 100,
        locked: true,
        dayKey: '2026-08-10',
        metering: false,
        setLimitMinutes: jest.fn(),
      });

      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort, mockShort2],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      const { container } = render(<ShortsPageClient />);

      // Acknowledge the entry warning
      expect(screen.getByTestId('entry-continue')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('entry-continue'));

      // Hard Stop should render
      expect(
        screen.getByRole('status', { name: /exhausted/i }),
      ).toBeInTheDocument();

      // Player panel and shorts list mocks should NOT render
      expect(screen.queryByTestId('player-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shorts-list')).not.toBeInTheDocument();

      // Verify no youtube.com links in the actual Hard Stop component
      const allLinks = container.querySelectorAll('a[href]');
      allLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        expect(href).not.toContain('youtube.com');
        expect(href).not.toContain('www.youtube');
      });
    });
  });

  describe('unlocked branch — player and list render after acknowledging', () => {
    it('renders player, navigation, and Shorts list when unlocked after acknowledging', () => {
      (useShortsBudget as jest.Mock).mockReturnValue({
        spentMs: 0,
        limitMs: 3600000,
        remainingMs: 3600000,
        usedPercent: 0,
        locked: false,
        dayKey: '2026-08-10',
        metering: false,
        setLimitMinutes: jest.fn(),
      });

      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort, mockShort2],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);

      // Acknowledge the entry warning
      expect(screen.getByTestId('entry-continue')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('entry-continue'));

      // Player panel mock should render
      expect(screen.getByTestId('player-panel')).toBeInTheDocument();

      // Shorts list mock should render with all shorts
      expect(screen.getByTestId('shorts-list')).toBeInTheDocument();
      expect(screen.getByTestId('short-dQw4w9WgXcQ')).toBeInTheDocument();
      expect(screen.getByTestId('short-video2')).toBeInTheDocument();

      // Hard Stop should NOT render
      expect(
        screen.queryByRole('status', { name: /exhausted/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('gates — entry warning and connection', () => {
    it('shows entry warning gate on initial render before acknowledgement', () => {
      (useShortsBudget as jest.Mock).mockReturnValue({
        spentMs: 0,
        limitMs: 3600000,
        remainingMs: 3600000,
        usedPercent: 0,
        locked: false,
        dayKey: '2026-08-10',
        metering: false,
        setLimitMinutes: jest.fn(),
      });

      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);

      expect(screen.getByTestId('entry-continue')).toBeInTheDocument();
      expect(screen.queryByTestId('player')).not.toBeInTheDocument();
    });

    it('shows connection gate when not connected', () => {
      (useYouTubeStatus as jest.Mock).mockReturnValue({
        connected: false,
        status: 'ready',
      });

      (useShortsBudget as jest.Mock).mockReturnValue({
        spentMs: 0,
        limitMs: 3600000,
        remainingMs: 3600000,
        usedPercent: 0,
        locked: false,
        dayKey: '2026-08-10',
        metering: false,
        setLimitMinutes: jest.fn(),
      });

      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);

      expect(
        screen.getByText(/Connect Your YouTube Account/i),
      ).toBeInTheDocument();
    });
  });
  describe('metering fails closed when the embed never reports state', () => {
    const unlockedBudget = {
      spentMs: 0,
      limitMs: 3600000,
      remainingMs: 3600000,
      usedPercent: 0,
      locked: false,
      dayKey: '2026-08-10',
      metering: false,
      setLimitMinutes: jest.fn(),
    };

    /** The `active` argument the page last handed `useShortsBudget`. */
    const lastMeteringArg = () => {
      const calls = (useShortsBudget as jest.Mock).mock.calls;
      return calls[calls.length - 1][0];
    };

    const renderAcknowledged = () => {
      (useShortsBudget as jest.Mock).mockReturnValue(unlockedBudget);
      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort, mockShort2],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);
      fireEvent.click(screen.getByTestId('entry-continue'));
    };

    it('does not meter before the User presses Play', () => {
      renderAcknowledged();

      expect(lastMeteringArg()).toBe(false);
    });

    it('meters from the Play press alone when no state ever arrives', () => {
      renderAcknowledged();

      fireEvent.click(screen.getByTestId('press-play'));

      // The embed has reported nothing. Metering must still be running, or the
      // Shorts Hard Stop would never fire for a User whose embed is silent.
      expect(lastMeteringArg()).toBe(true);
    });

    it('stops metering when the embed reports a pause and resumes on play', () => {
      renderAcknowledged();

      fireEvent.click(screen.getByTestId('press-play'));
      fireEvent.click(screen.getByTestId('report-paused'));
      expect(lastMeteringArg()).toBe(false);

      fireEvent.click(screen.getByTestId('report-playing'));
      expect(lastMeteringArg()).toBe(true);
    });

    it('keeps metering across Shorts, because the embed autoplays the next one', () => {
      renderAcknowledged();

      fireEvent.click(screen.getByTestId('press-play'));
      fireEvent.click(screen.getByTestId('short-video2'));

      expect(lastMeteringArg()).toBe(true);
    });

    it('re-arms after a pause when the User moves to another Short', () => {
      renderAcknowledged();

      fireEvent.click(screen.getByTestId('press-play'));
      fireEvent.click(screen.getByTestId('report-paused'));
      expect(lastMeteringArg()).toBe(false);

      // The stale pause belongs to the previous Short; the new one autoplays.
      fireEvent.click(screen.getByTestId('short-video2'));
      expect(lastMeteringArg()).toBe(true);
    });

    it('stops metering when the embed refuses to play the Short', () => {
      renderAcknowledged();

      fireEvent.click(screen.getByTestId('press-play'));
      fireEvent.click(screen.getByTestId('report-unavailable'));

      expect(lastMeteringArg()).toBe(false);
    });

    it('does not meter while the entry warning is still up', () => {
      (useShortsBudget as jest.Mock).mockReturnValue(unlockedBudget);
      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);

      expect(lastMeteringArg()).toBe(false);
    });

    it('does not meter once the budget is locked', () => {
      (useShortsBudget as jest.Mock).mockReturnValue({
        ...unlockedBudget,
        spentMs: 3600000,
        remainingMs: 0,
        usedPercent: 100,
        locked: true,
      });
      (useYouTubeShorts as jest.Mock).mockReturnValue({
        shorts: [mockShort],
        loading: false,
        error: null,
        updateWatched: jest.fn(),
        refresh: jest.fn(),
      });

      render(<ShortsPageClient />);
      fireEvent.click(screen.getByTestId('entry-continue'));

      expect(lastMeteringArg()).toBe(false);
    });
  });
});
