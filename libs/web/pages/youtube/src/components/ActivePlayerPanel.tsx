'use client';

import { Button } from '@myorganizer/web-ui';
import { X } from 'lucide-react';
import { useCallback } from 'react';
import type { YouTubeVideo } from '../types';
import { YouTubeVideoPlayer } from './YouTubeVideoPlayer';

interface ActivePlayerPanelProps {
  activeVideoId: string;
  video?: YouTubeVideo;
  onClose: () => void;
  onNearEnd: () => void;
}

export function ActivePlayerPanel({
  activeVideoId,
  video,
  onClose,
  onNearEnd,
}: ActivePlayerPanelProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  if (!video) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="rounded-lg border border-border bg-card p-4 lg:sticky lg:top-2 lg:z-10"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{video.title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
          aria-label="Close player"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <YouTubeVideoPlayer
        key={activeVideoId}
        video={video}
        watched={video.watched ?? false}
        onNearEnd={onNearEnd}
        defaultPlaying
      />
    </div>
  );
}
