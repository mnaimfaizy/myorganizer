'use client';

import { Badge, Button } from '@myorganizer/web-ui';
import { CheckCircle, Circle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { updateVideoWatched } from '../hooks';
import type { YouTubeVideo } from '../types';

interface VideoCardProps {
  video: YouTubeVideo;
  onWatchedToggle?: (videoId: string, watched: boolean) => void;
}

export function VideoCard({ video, onWatchedToggle }: VideoCardProps) {
  const [watched, setWatched] = useState<boolean>(!!video.watched);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWatched(!!video.watched);
  }, [video.watched]);

  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  const formattedDate = new Date(video.publishedAt).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );

  const handleToggleWatched = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const nextWatched = !watched;
      const prevWatched = watched;

      setWatched(nextWatched);
      setUpdating(true);
      setError(null);

      try {
        const result = await updateVideoWatched(video.videoId, nextWatched);
        setWatched(result.watched);
        onWatchedToggle?.(video.videoId, result.watched);
      } catch {
        setWatched(prevWatched);
        setError('Failed to update status');
      } finally {
        setUpdating(false);
      }
    },
    [watched, video.videoId, onWatchedToggle],
  );

  return (
    <div className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {video.thumbnail ? (
          <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute right-2 top-2 z-10">
              <Badge
                variant={watched ? 'secondary' : 'default'}
                className={
                  watched
                    ? 'bg-gray-800/80 text-gray-200 backdrop-blur-sm dark:bg-gray-900/80 dark:text-gray-300'
                    : 'bg-blue-600/90 text-white backdrop-blur-sm'
                }
              >
                {watched ? 'Watched' : 'New'}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="relative flex aspect-video w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
            <span className="text-3xl text-gray-400">▶</span>
            <div className="absolute right-2 top-2 z-10">
              <Badge
                variant={watched ? 'secondary' : 'default'}
                className={
                  watched
                    ? 'bg-gray-800/80 text-gray-200 backdrop-blur-sm dark:bg-gray-900/80 dark:text-gray-300'
                    : 'bg-blue-600/90 text-white backdrop-blur-sm'
                }
              >
                {watched ? 'Watched' : 'New'}
              </Badge>
            </div>
          </div>
        )}
      </a>

      <div className="p-3">
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {video.title}
          </h3>
        </a>

        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {video.channelTitle && (
            <>
              <span className="truncate">{video.channelTitle}</span>
              <span>·</span>
            </>
          )}
          <span>{formattedDate}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleWatched}
            disabled={updating}
            className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            aria-label={
              watched
                ? `Mark ${video.title} as new`
                : `Mark ${video.title} as watched`
            }
          >
            {watched ? (
              <>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                Mark as new
              </>
            ) : (
              <>
                <Circle className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                Mark as watched
              </>
            )}
          </Button>

          {error && (
            <span
              role="alert"
              className="text-[10px] font-medium text-red-600 dark:text-red-400"
            >
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
