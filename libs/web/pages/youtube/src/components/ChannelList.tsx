'use client';

import { cn } from '@myorganizer/web-ui';
import type { KeyboardEvent, MutableRefObject } from 'react';
import type { ChannelCarousel } from '../types';

interface ChannelListProps {
  channels: ChannelCarousel[];
  selectedChannelId: string | null;
  desktopRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  mobileRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  onSelect: (channelId: string) => void;
  onKeyDown: (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
    layoutType: 'desktop' | 'mobile',
  ) => void;
}

export function ChannelList({
  channels,
  selectedChannelId,
  desktopRefs,
  mobileRefs,
  onSelect,
  onKeyDown,
}: ChannelListProps) {
  return (
    <>
      {/* Desktop: Aside channel list */}
      <aside className="hidden lg:flex w-48 shrink-0 flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Channels
        </h2>
        <nav
          aria-label="Enabled channels"
          className="space-y-1 overflow-y-auto max-h-96"
        >
          {channels.map((channel, index) => {
            const isSelected = channel.channelId === selectedChannelId;
            const newCount = channel.videos.filter((v) => !v.watched).length;
            return (
              <button
                key={channel.channelId}
                ref={(el) => {
                  desktopRefs.current[index] = el;
                }}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, index, 'desktop')}
                onClick={() => onSelect(channel.channelId)}
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {channel.channelThumbnail ? (
                  <img
                    src={channel.channelThumbnail}
                    alt=""
                    className="h-6 w-6 rounded-full shrink-0"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold shrink-0 dark:bg-gray-700">
                    {channel.channelTitle.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{channel.channelTitle}</p>
                  <p className="truncate text-xs opacity-75">
                    {channel.videos.length} upload
                    {channel.videos.length !== 1 ? 's' : ''}
                    {newCount > 0 && ` · ${newCount} New`}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: Channel chips */}
      <div className="lg:hidden">
        <nav
          aria-label="Enabled channels"
          className="flex gap-2 overflow-x-auto pb-2 flex-wrap"
        >
          {channels.map((channel, index) => {
            const isSelected = channel.channelId === selectedChannelId;
            const uploadCount = channel.videos.length;
            const newCount = channel.videos.filter((v) => !v.watched).length;
            return (
              <button
                key={channel.channelId}
                ref={(el) => {
                  mobileRefs.current[index] = el;
                }}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, index, 'mobile')}
                onClick={() => onSelect(channel.channelId)}
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors',
                  isSelected
                    ? 'bg-blue-600 text-white dark:bg-blue-700'
                    : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600',
                )}
              >
                {channel.channelTitle}
                <span className="ml-1.5 text-xs opacity-70">{uploadCount}</span>
                {newCount > 0 && (
                  <span
                    className="ml-1 font-bold"
                    aria-label={`${newCount} new`}
                  >
                    {newCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
