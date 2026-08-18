'use client';

import { cn } from '@myorganizer/web-ui';
import type { KeyboardEvent, MutableRefObject } from 'react';
import type { ChannelCarousel } from '../types';

interface ChannelListProps {
  channels: ChannelCarousel[];
  selectedChannelId: string | null;
  /** Id of the detail pane these tabs swap, for `aria-controls`. */
  panelId: string;
  desktopRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  mobileRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  onSelect: (channelId: string) => void;
  onKeyDown: (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
    layoutType: 'desktop' | 'mobile',
  ) => void;
}

/**
 * Channel selector for the locked channel-first directory.
 *
 * Rendered as a tab set rather than a nav landmark. Decision #261 requires
 * arrow-key movement within the channel list with a single tab stop for the
 * whole set, which is the ARIA tabs keyboard contract; announcing the same
 * controls as navigation left the behaviour and the role disagreeing. The
 * locked prototype predates #261 and has no arrow keys at all, so it is not
 * authority against this.
 *
 * Both layouts are in the DOM at once and hidden by CSS, so every id is
 * per-layout. `aria-orientation` states the axis the arrow keys follow, which
 * is vertical for the desktop rail and horizontal for the mobile chips.
 */
export function ChannelList({
  channels,
  selectedChannelId,
  panelId,
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
        <div
          role="tablist"
          aria-label="Enabled channels"
          aria-orientation="vertical"
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
                id={`channel-tab-desktop-${channel.channelId}`}
                role="tab"
                type="button"
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, index, 'desktop')}
                onClick={() => onSelect(channel.channelId)}
                aria-selected={isSelected}
                aria-controls={panelId}
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
        </div>
      </aside>

      {/* Mobile: Channel chips */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Enabled channels"
          aria-orientation="horizontal"
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
                id={`channel-tab-mobile-${channel.channelId}`}
                role="tab"
                type="button"
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={(e) => onKeyDown(e, index, 'mobile')}
                onClick={() => onSelect(channel.channelId)}
                aria-selected={isSelected}
                aria-controls={panelId}
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
        </div>
      </div>
    </>
  );
}
