'use client';

import { Button } from '@myorganizer/web-ui';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import type { ChannelCarousel } from '../types';
import { VideoCard } from './VideoCard';

interface ChannelUploadsRowProps {
  channel: ChannelCarousel;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
}

export function ChannelUploadsRow({
  channel,
  onWatchedToggle,
}: ChannelUploadsRowProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const youtubeChannelUrl = `https://www.youtube.com/channel/${encodeURIComponent(
    channel.channelId,
  )}`;

  const prefersReducedMotion = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  const handleChannelClick = useCallback(() => {
    router.push(
      `/dashboard/youtube/channel/${encodeURIComponent(channel.channelId)}`,
    );
  }, [router, channel.channelId]);

  const handleScrollLeft = useCallback(() => {
    handleScroll('left');
  }, [handleScroll]);

  const handleScrollRight = useCallback(() => {
    handleScroll('right');
  }, [handleScroll]);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = Math.min(index + 1, channel.videos.length - 1);
        setFocusedCardIndex(nextIndex);
        cardRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setFocusedCardIndex(prevIndex);
        cardRefs.current[prevIndex]?.focus();
      }
    },
    [channel.videos.length],
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        id={`channel-title-${channel.channelId}`}
        className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={handleChannelClick}
      >
        {channel.channelThumbnail ? (
          <img
            src={channel.channelThumbnail}
            alt=""
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold dark:bg-gray-700">
            {channel.channelTitle.charAt(0)}
          </div>
        )}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {channel.channelTitle}
        </h3>
      </button>

      {channel.videos.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No Cached Uploads yet for {channel.channelTitle}.
          </p>
          <a
            href={youtubeChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Open channel on YouTube
          </a>
        </div>
      ) : (
        <div className="group relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={handleScrollLeft}
            aria-label="Scroll left"
          >
            ←
          </Button>

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-thin"
          >
            {channel.videos.map((video, index) => (
              <div
                key={video.id}
                className="w-56 shrink-0"
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                tabIndex={focusedCardIndex === index ? 0 : -1}
                onKeyDown={(e) => handleCardKeyDown(e, index)}
              >
                <VideoCard video={video} onWatchedToggle={onWatchedToggle} />
              </div>
            ))}

            <div className="w-56 shrink-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                MyOrganizer stores only recent uploads from each channel. Older
                uploads are not cached here.
              </p>
              <a
                href={youtubeChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Open channel on YouTube
              </a>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={handleScrollRight}
            aria-label="Scroll right"
          >
            →
          </Button>
        </div>
      )}
    </div>
  );
}
