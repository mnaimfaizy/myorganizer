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

jest.mock('./YouTubeVideoPlayer', () => ({
  YouTubeVideoPlayer: () => <div data-testid="player">Player</div>,
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

      expect(screen.getByTestId('entry-continue')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('entry-continue'));

      expect(
        screen.getByRole('status', { name: /exhausted/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('player')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Prev/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Next/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Test Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Another Short')).not.toBeInTheDocument();
      expect(screen.queryByText(/All Shorts/i)).not.toBeInTheDocument();

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

      expect(screen.getByTestId('entry-continue')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('entry-continue'));

      expect(screen.getByTestId('player')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Prev/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
      expect(screen.getAllByText('Test Short').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Another Short').length).toBeGreaterThan(0);
      expect(screen.getByText(/All Shorts/i)).toBeInTheDocument();
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
});
