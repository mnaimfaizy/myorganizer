import { fireEvent, render, screen } from '@testing-library/react';

import type { SortOption, YouTubeVideo } from '../types';
import { VideoGrid } from './VideoGrid';

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: any) => <input {...props} />,
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

jest.mock('./VideoCard', () => ({
  VideoCard: ({ video }: any) => (
    <div data-testid="video-card">{video.title}</div>
  ),
}));

const makeVideo = (id: string, title: string): YouTubeVideo => ({
  id,
  videoId: `vid-${id}`,
  title,
  channelTitle: 'Channel',
  channelId: 'ch-1',
  thumbnail: `https://example.com/${id}.jpg`,
  publishedAt: '2024-01-01T00:00:00Z',
  description: '',
});

const defaultProps = {
  videos: [makeVideo('1', 'First Video'), makeVideo('2', 'Second Video')],
  loading: false,
  sort: 'latest' as SortOption,
  onSortChange: jest.fn(),
  search: '',
  onSearchChange: jest.fn(),
  page: 1,
  totalPages: 1,
  onPageChange: jest.fn(),
  total: 2,
};

describe('VideoGrid', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should render sort buttons', () => {
    render(<VideoGrid {...defaultProps} />);
    expect(screen.getByText('Latest')).toBeTruthy();
    expect(screen.getByText('Oldest')).toBeTruthy();
    expect(screen.getByText('A - Z')).toBeTruthy();
  });

  it('should render search input', () => {
    render(<VideoGrid {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search your videos…')).toBeTruthy();
  });

  it('should render video cards', () => {
    render(<VideoGrid {...defaultProps} />);
    const cards = screen.getAllByTestId('video-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('First Video')).toBeTruthy();
    expect(screen.getByText('Second Video')).toBeTruthy();
  });

  it('should display total count', () => {
    render(<VideoGrid {...defaultProps} />);
    expect(screen.getByText('2 videos')).toBeTruthy();
  });

  it('should use singular for 1 video', () => {
    render(
      <VideoGrid
        {...defaultProps}
        videos={[makeVideo('1', 'Only')]}
        total={1}
      />,
    );
    expect(screen.getByText('1 video')).toBeTruthy();
  });

  it('should call onSortChange when sort button clicked', () => {
    const onSortChange = jest.fn();
    render(<VideoGrid {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByText('Oldest'));
    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('should call onSearchChange when typing in search', () => {
    const onSearchChange = jest.fn();
    render(<VideoGrid {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search your videos…'), {
      target: { value: 'test' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('test');
  });

  it('should show loading skeletons', () => {
    render(<VideoGrid {...defaultProps} loading={true} videos={[]} />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(8);
  });

  it('should show empty state when no videos', () => {
    render(<VideoGrid {...defaultProps} videos={[]} total={0} />);
    expect(screen.getByText('No videos found.')).toBeTruthy();
  });

  it('should show pagination when totalPages > 1', () => {
    render(<VideoGrid {...defaultProps} page={1} totalPages={3} />);
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  });

  it('should disable Previous on first page', () => {
    render(<VideoGrid {...defaultProps} page={1} totalPages={3} />);
    expect((screen.getByText('Previous') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('should disable Next on last page', () => {
    render(<VideoGrid {...defaultProps} page={3} totalPages={3} />);
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should call onPageChange when Next clicked', () => {
    const onPageChange = jest.fn();
    render(
      <VideoGrid
        {...defaultProps}
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should not show pagination when only 1 page', () => {
    render(<VideoGrid {...defaultProps} page={1} totalPages={1} />);
    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.queryByText('Next')).toBeNull();
  });
});
