'use client';

import { Button, Skeleton } from '@myorganizer/web-ui';
import { useRef } from 'react';
import type { ChannelCarousel } from '../types';
import { VideoCard } from './VideoCard';

interface VideoCarouselProps {
  channels: ChannelCarousel[];
  loading: boolean;
}

function ChannelRow({ channel }: { channel: ChannelCarousel }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {channel.channelThumbnail ? (
          <img
            src={channel.channelThumbnail}
            alt={channel.channelTitle}
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
      </div>

      <div className="group relative">
        <Button
          variant="outline"
          size="sm"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          ←
        </Button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-thin"
        >
          {channel.videos.map((video) => (
            <div key={video.id} className="w-56 flex-shrink-0">
              <VideoCard video={video} />
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          →
        </Button>
      </div>
    </div>
  );
}

export function VideoCarousel({ channels, loading }: VideoCarouselProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48 rounded" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-36 w-56 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        No videos found.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {channels.map((channel) => (
        <ChannelRow key={channel.channelId} channel={channel} />
      ))}
    </div>
  );
}
