'use client';

import { Button, cn } from '@myorganizer/web-ui';
import { ChevronDown, ChevronUp, Play, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { YouTubeVideo } from '../types';

interface QueueRailItemProps {
  video: YouTubeVideo;
  index: number;
  isCurrentlyPlaying: boolean;
  focusedRowIndex: number;
  onRegisterPlayButton: (index: number, el: HTMLButtonElement | null) => void;
  onPlay: (videoId: string) => void;
  onRemove: (videoId: string) => void;
  onMoveUp: (videoId: string) => void;
  onMoveDown: (videoId: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => void;
  queueLength: number;
}

export function QueueRailItem({
  video,
  index,
  isCurrentlyPlaying,
  focusedRowIndex,
  onRegisterPlayButton,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
  onKeyDown,
  queueLength,
}: QueueRailItemProps) {
  const handlePlayClick = useCallback(() => {
    onPlay(video.videoId);
  }, [video.videoId, onPlay]);

  const handleRemoveClick = useCallback(() => {
    onRemove(video.videoId);
  }, [video.videoId, onRemove]);

  const handleMoveUpClick = useCallback(() => {
    onMoveUp(video.videoId);
  }, [video.videoId, onMoveUp]);

  const handleMoveDownClick = useCallback(() => {
    onMoveDown(video.videoId);
  }, [video.videoId, onMoveDown]);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown(e, index);
    },
    [index, onKeyDown],
  );

  const handleRegisterPlayButton = useCallback(
    (el: HTMLButtonElement | null) => {
      onRegisterPlayButton(index, el);
    },
    [index, onRegisterPlayButton],
  );

  const watchedState = video.watched ? 'Watched' : 'New';
  const canMoveUp = index > 0;
  const canMoveDown = index < queueLength - 1;

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2 transition-colors motion-reduce:transition-none',
        isCurrentlyPlaying
          ? 'border-brand bg-brand/10'
          : 'border-border bg-card hover:bg-muted',
      )}
      aria-current={isCurrentlyPlaying ? 'true' : undefined}
    >
      <div className="relative shrink-0">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
            <span aria-hidden="true">▶</span>
          </div>
        )}
        {isCurrentlyPlaying && (
          <div
            className="absolute inset-0 rounded bg-black/40 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">Playing</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p className="line-clamp-1 text-xs font-medium text-foreground">
              {video.title}
            </p>
            {video.channelTitle && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {video.channelTitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs">
            {isCurrentlyPlaying && (
              <span className="font-semibold text-brand">Now playing</span>
            )}
            <span className="text-muted-foreground">{watchedState}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleMoveUpClick}
          disabled={!canMoveUp}
          className="min-h-10 min-w-10 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
          aria-label={`Move ${video.title} up`}
          title={canMoveUp ? `Move ${video.title} up` : 'Cannot move up'}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleMoveDownClick}
          disabled={!canMoveDown}
          className="min-h-10 min-w-10 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
          aria-label={`Move ${video.title} down`}
          title={canMoveDown ? `Move ${video.title} down` : 'Cannot move down'}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        <Button
          ref={handleRegisterPlayButton}
          type="button"
          variant="ghost"
          size="sm"
          onClick={handlePlayClick}
          onKeyDown={handleRowKeyDown}
          tabIndex={focusedRowIndex === index ? 0 : -1}
          className="min-h-10 min-w-10 p-0 text-muted-foreground hover:text-foreground"
          aria-label={`Play ${video.title}`}
        >
          <Play className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemoveClick}
          className="min-h-10 min-w-10 p-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${video.title} from queue`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
