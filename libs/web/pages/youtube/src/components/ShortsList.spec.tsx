/* eslint-disable import/first */
import '@testing-library/jest-dom';

jest.mock('../lib/formatRuntimeSeconds', () => ({
  formatRuntimeSeconds: (seconds: number | null | undefined) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
      return '';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },
}));

import { render, screen, fireEvent } from '@testing-library/react';
import type { YouTubeVideo } from '../types';
import { ShortsList } from './ShortsList';

describe('ShortsList', () => {
  const mockShort1: YouTubeVideo = {
    id: 'short-1',
    videoId: 'video1',
    channelId: 'ch-1',
    title: 'First Short',
    thumbnail: 'https://example.com/thumb1.jpg',
    publishedAt: '2025-12-01T00:00:00Z',
    channelTitle: 'Channel A',
    watched: false,
    durationSeconds: 45,
  };

  const mockShort2: YouTubeVideo = {
    id: 'short-2',
    videoId: 'video2',
    channelId: 'ch-2',
    title: 'Second Short',
    thumbnail: 'https://example.com/thumb2.jpg',
    publishedAt: '2025-12-02T00:00:00Z',
    channelTitle: 'Channel B',
    watched: true,
    durationSeconds: 60,
  };

  const mockShortNoDuration: YouTubeVideo = {
    id: 'short-3',
    videoId: 'video3',
    channelId: 'ch-3',
    title: 'Short No Duration',
    thumbnail: 'https://example.com/thumb3.jpg',
    publishedAt: '2025-12-03T00:00:00Z',
    channelTitle: 'Channel C',
    watched: false,
    durationSeconds: null,
  };

  it('renders nothing when shorts list is empty', () => {
    const { container } = render(
      <ShortsList
        shorts={[]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per short', () => {
    render(
      <ShortsList
        shorts={[mockShort1, mockShort2]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button');
    // Expect exactly 2 buttons (one per short)
    expect(buttons).toHaveLength(2);
  });

  it('includes title, channel, and watched state in aria-label', () => {
    render(
      <ShortsList
        shorts={[mockShort1, mockShort2]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );

    // First short is new (not watched)
    const btn1 = screen.getByLabelText('First Short, Channel A (New)');
    expect(btn1).toBeInTheDocument();

    // Second short is watched
    const btn2 = screen.getByLabelText('Second Short, Channel B (Watched)');
    expect(btn2).toBeInTheDocument();
  });

  it('sets aria-current=true on the selected short only', () => {
    render(
      <ShortsList
        shorts={[mockShort1, mockShort2]}
        selectedShortId="video1"
        onSelectShort={jest.fn()}
      />,
    );

    const btn1 = screen.getByLabelText('First Short, Channel A (New)');
    const btn2 = screen.getByLabelText('Second Short, Channel B (Watched)');

    expect(btn1).toHaveAttribute('aria-current', 'true');
    expect(btn2).not.toHaveAttribute('aria-current');
  });

  it('calls onSelectShort with videoId when a short is clicked', () => {
    const onSelectShort = jest.fn();
    render(
      <ShortsList
        shorts={[mockShort1, mockShort2]}
        selectedShortId={null}
        onSelectShort={onSelectShort}
      />,
    );

    const btn1 = screen.getByLabelText('First Short, Channel A (New)');
    fireEvent.click(btn1);

    expect(onSelectShort).toHaveBeenCalledTimes(1);
    expect(onSelectShort).toHaveBeenCalledWith('video1');
  });

  it('renders runtime when durationSeconds is set', () => {
    render(
      <ShortsList
        shorts={[mockShort1]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );

    // mockShort1 has durationSeconds: 45, so should format to 0:45
    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('renders nothing for runtime when durationSeconds is null', () => {
    render(
      <ShortsList
        shorts={[mockShortNoDuration]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );

    // Should not render any text that looks like runtime (M:SS format)
    const button = screen.getByLabelText('Short No Duration, Channel C (New)');
    expect(button).toBeInTheDocument();

    // The runtime span should not be rendered
    const runtimeSpans = screen.queryAllByText(/^\d+:\d{2}$/);
    expect(runtimeSpans).toHaveLength(0);
  });

  it('renders Watched text for watched shorts and New text for unwatched', () => {
    render(
      <ShortsList
        shorts={[mockShort1, mockShort2]}
        selectedShortId={null}
        onSelectShort={jest.fn()}
      />,
    );

    // mockShort1 is watched: false, so should show "New"
    // mockShort2 is watched: true, so should show "Watched"
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Watched')).toBeInTheDocument();
  });
});
