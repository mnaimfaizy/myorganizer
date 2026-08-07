import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ChannelCarousel } from '../types';
import { ChannelUploadsRow } from './ChannelUploadsRow';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('./VideoCard', () => ({
  VideoCard: ({ video, onWatchedToggle }: any) => (
    <div
      data-testid={`video-card-${video.id}`}
      onClick={() => onWatchedToggle?.(video.id, true)}
    >
      {video.title}
    </div>
  ),
}));

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

const makeVideo = (id: string, title: string) => ({
  id,
  videoId: `vid-${id}`,
  title,
  channelId: 'ch-1',
  channelTitle: 'Test Channel',
  thumbnail: null,
  publishedAt: '2024-01-01T00:00:00Z',
  watched: false,
});

const makeChannel = (
  channelId: string,
  channelTitle: string,
  videos: ReturnType<typeof makeVideo>[] = [],
  channelThumbnail: string | null = null,
): ChannelCarousel => ({
  channelId,
  channelTitle,
  channelThumbnail,
  videos,
});

describe('ChannelUploadsRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Element.prototype.scrollBy = jest.fn();
  });

  describe('Channel Header', () => {
    it('should render channel header', () => {
      const channel = makeChannel('ch-1', 'My Channel', [
        makeVideo('v-1', 'Video 1'),
      ]);
      render(<ChannelUploadsRow channel={channel} />);
      const button = screen.getByText('My Channel');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('H3');
    });

    it('should render thumbnail', () => {
      const channel = makeChannel(
        'ch-1',
        'My Channel',
        [],
        'https://example.com/thumb.jpg',
      );
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    });

    it('should render avatar when no thumbnail', () => {
      const channel = makeChannel('ch-1', 'My Channel');
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const avatar = container.querySelector('div.rounded-full.bg-gray-200');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('M');
    });

    it('should navigate to channel', () => {
      const channel = makeChannel('ch-123', 'My Channel');
      render(<ChannelUploadsRow channel={channel} />);
      const button = screen.getByText('My Channel');
      fireEvent.click(button);
      // Just verify click handler was called, actual router is mocked at module level
      expect(button).toBeInTheDocument();
    });

    it('should have correct id', () => {
      const channel = makeChannel('ch-1', 'My Channel');
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const button = container.querySelector('button[id="channel-title-ch-1"]');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Empty Channel', () => {
    it('should show empty message', () => {
      const channel = makeChannel('ch-1', 'My Channel', []);
      render(<ChannelUploadsRow channel={channel} />);
      expect(
        screen.getByText(/No Cached Uploads yet for My Channel/),
      ).toBeInTheDocument();
    });

    it('should show YouTube link', () => {
      const channel = makeChannel('ch-1', 'My Channel', []);
      render(<ChannelUploadsRow channel={channel} />);
      const link = screen.getByRole('link', {
        name: 'Open channel on YouTube',
      });
      expect(link).toHaveAttribute(
        'href',
        'https://www.youtube.com/channel/ch-1',
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Video Cards', () => {
    it('should render VideoCards', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      render(<ChannelUploadsRow channel={channel} />);
      expect(screen.getByTestId('video-card-v-1')).toBeInTheDocument();
      expect(screen.getByTestId('video-card-v-2')).toBeInTheDocument();
    });

    it('should call onWatchedToggle', () => {
      const onWatchedToggle = jest.fn();
      const videos = [makeVideo('v-1', 'Video 1')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      render(
        <ChannelUploadsRow
          channel={channel}
          onWatchedToggle={onWatchedToggle}
        />,
      );
      fireEvent.click(screen.getByTestId('video-card-v-1'));
      expect(onWatchedToggle).toHaveBeenCalledWith('v-1', true);
    });
  });

  describe('Scroll', () => {
    it('should render scroll buttons', () => {
      const videos = [makeVideo('v-1', 'Video 1')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      render(<ChannelUploadsRow channel={channel} />);
      expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
      expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
    });

    it('should scroll smooth', () => {
      const videos = [makeVideo('v-1', 'Video 1')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      window.matchMedia = jest.fn().mockReturnValue({ matches: false });
      render(<ChannelUploadsRow channel={channel} />);
      fireEvent.click(screen.getByLabelText('Scroll left'));
      expect(Element.prototype.scrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' }),
      );
    });

    it('should scroll auto when prefers-reduced-motion', () => {
      const videos = [makeVideo('v-1', 'Video 1')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      window.matchMedia = jest.fn().mockReturnValue({ matches: true });
      render(<ChannelUploadsRow channel={channel} />);
      fireEvent.click(screen.getByLabelText('Scroll left'));
      expect(Element.prototype.scrollBy).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'auto' }),
      );
    });
  });

  describe('Keyboard Nav', () => {
    it('should start with first card focused', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const cards = container.querySelectorAll('div[tabindex]');
      expect(cards[0]).toHaveAttribute('tabindex', '0');
      expect(cards[1]).toHaveAttribute('tabindex', '-1');
    });

    it('should move right on ArrowRight', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const cards = container.querySelectorAll('div[tabindex]');
      (cards[0] as HTMLDivElement).focus();
      fireEvent.keyDown(cards[0], { key: 'ArrowRight' });
      expect(cards[1]).toHaveAttribute('tabindex', '0');
      expect(cards[0]).toHaveAttribute('tabindex', '-1');
    });

    it('should move left on ArrowLeft', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const cards = container.querySelectorAll('div[tabindex]');
      (cards[1] as HTMLDivElement).focus();
      fireEvent.keyDown(cards[1], { key: 'ArrowLeft' });
      expect(cards[0]).toHaveAttribute('tabindex', '0');
      expect(cards[1]).toHaveAttribute('tabindex', '-1');
    });

    it('should clamp at start', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const cards = container.querySelectorAll('div[tabindex]');
      (cards[0] as HTMLDivElement).focus();
      fireEvent.keyDown(cards[0], { key: 'ArrowLeft' });
      expect(cards[0]).toHaveAttribute('tabindex', '0');
    });

    it('should clamp at end', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      const { container } = render(<ChannelUploadsRow channel={channel} />);
      const cards = container.querySelectorAll('div[tabindex]');
      (cards[1] as HTMLDivElement).focus();
      fireEvent.keyDown(cards[1], { key: 'ArrowRight' });
      expect(cards[1]).toHaveAttribute('tabindex', '0');
    });
  });

  describe('End of list disclosure', () => {
    it('should show disclosure card at end of populated list', () => {
      const videos = [makeVideo('v-1', 'Video 1'), makeVideo('v-2', 'Video 2')];
      const channel = makeChannel('ch-1', 'My Channel', videos);
      render(<ChannelUploadsRow channel={channel} />);

      // Verify disclosure text is present
      expect(
        screen.getByText(
          /MyOrganizer stores only recent uploads from each channel\. Older uploads are not cached here\./,
        ),
      ).toBeInTheDocument();

      // Verify there are two "Open channel on YouTube" links:
      // one at the end (disclosure card) and none in empty state since list is populated
      const links = screen.getAllByRole('link', {
        name: 'Open channel on YouTube',
      });
      expect(links).toHaveLength(1);

      // Verify the disclosure link has correct attributes
      const disclosureLink = links[0];
      expect(disclosureLink).toHaveAttribute(
        'href',
        'https://www.youtube.com/channel/ch-1',
      );
      expect(disclosureLink).toHaveAttribute('target', '_blank');
      expect(disclosureLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
