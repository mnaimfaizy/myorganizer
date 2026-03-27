'use client';

import type { YouTubeVideo } from '../types';

interface VideoCardProps {
  video: YouTubeVideo;
}

export function VideoCard({ video }: VideoCardProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  const formattedDate = new Date(video.publishedAt).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
    >
      {video.thumbnail ? (
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-3xl text-gray-400">▶</span>
        </div>
      )}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
          {video.title}
        </h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {video.channelTitle && (
            <>
              <span className="truncate">{video.channelTitle}</span>
              <span>·</span>
            </>
          )}
          <span>{formattedDate}</span>
        </div>
      </div>
    </a>
  );
}
