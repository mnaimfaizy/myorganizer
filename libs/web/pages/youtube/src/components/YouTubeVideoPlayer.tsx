'use client';

import { Badge, Button, cn } from '@myorganizer/web-ui';
import { AlertCircle, ExternalLink, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { YouTubeVideo } from '../types';

export interface YouTubeVideoPlayerProps {
  video: YouTubeVideo;
  watched?: boolean;
  onNearEnd?: () => void;
  onPlay?: () => void;
  onPlaybackUnavailable?: () => void;
  className?: string;
  defaultPlaying?: boolean;
}

const YOUTUBE_EMBED_ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
];

const YOUTUBE_TARGET_ORIGIN = 'https://www.youtube-nocookie.com';

export function YouTubeVideoPlayer({
  video,
  watched = false,
  onNearEnd,
  onPlay,
  onPlaybackUnavailable,
  className = '',
  defaultPlaying = false,
}: YouTubeVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(defaultPlaying);
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIframeReady, setIsIframeReady] = useState<boolean>(false);

  const hasFiredNearEndRef = useRef<boolean>(false);
  const lastWatchedRef = useRef<boolean>(watched);
  const lastDurationRef = useRef<number | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!watched) {
      hasFiredNearEndRef.current = false;
    }
    lastWatchedRef.current = watched;
  }, [watched, video.videoId]);

  useEffect(() => {
    if (isPlaying && iframeRef.current) {
      iframeRef.current.focus?.();
    }
  }, [isPlaying]);

  const postToIframe = useCallback((payload: object) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify(payload),
        YOUTUBE_TARGET_ORIGIN,
      );
    } catch {
      // Ignore postMessage transmission errors
    }
  }, []);

  const initIframeListening = useCallback(() => {
    postToIframe({ event: 'listening', id: 1, channel: 'widget' });
    postToIframe({
      event: 'command',
      func: 'addEventListener',
      args: ['onStateChange'],
      id: 1,
      channel: 'widget',
    });
    postToIframe({
      event: 'command',
      func: 'getCurrentTime',
      args: [],
      id: 1,
      channel: 'widget',
    });
    postToIframe({
      event: 'command',
      func: 'getDuration',
      args: [],
      id: 1,
      channel: 'widget',
    });
  }, [postToIframe]);

  const requestIframeProgress = useCallback(() => {
    postToIframe({
      event: 'command',
      func: 'getCurrentTime',
      args: [],
      id: 1,
      channel: 'widget',
    });
    postToIframe({
      event: 'command',
      func: 'getDuration',
      args: [],
      id: 1,
      channel: 'widget',
    });
    postToIframe({ event: 'listening', id: 1, channel: 'widget' });
  }, [postToIframe]);

  const handleNearEndCheck = useCallback(
    (currentTime: number, duration: number) => {
      if (
        typeof currentTime !== 'number' ||
        typeof duration !== 'number' ||
        !Number.isFinite(currentTime) ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        currentTime < 0
      ) {
        return;
      }

      if (lastWatchedRef.current !== watched) {
        if (!watched) {
          hasFiredNearEndRef.current = false;
        }
        lastWatchedRef.current = watched;
      }

      if (watched || hasFiredNearEndRef.current) {
        return;
      }

      const threshold = Math.max(duration * 0.9, duration - 30);
      if (currentTime >= threshold) {
        hasFiredNearEndRef.current = true;
        onNearEnd?.();
      }
    },
    [watched, onNearEnd],
  );

  const handleMarkUnavailable = useCallback(
    (reason?: string) => {
      setIsUnavailable(true);
      setErrorMessage(
        reason || 'Playback is restricted or unavailable for this video.',
      );
      onPlaybackUnavailable?.();
    },
    [onPlaybackUnavailable],
  );

  useEffect(() => {
    if (!isPlaying || isUnavailable || !isIframeReady) return;

    initIframeListening();
    requestIframeProgress();

    const intervalId = setInterval(() => {
      requestIframeProgress();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    isPlaying,
    isUnavailable,
    isIframeReady,
    initIframeListening,
    requestIframeProgress,
  ]);

  useEffect(() => {
    if (!isPlaying || isUnavailable) return;

    const handleMessage = (event: MessageEvent) => {
      if (!YOUTUBE_EMBED_ORIGINS.includes(event.origin)) {
        return;
      }

      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }

      if (!event.data) return;

      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (typeof payload !== 'object' || payload === null) return;

      const record = payload as Record<string, unknown>;

      const info =
        record.info && typeof record.info === 'object' && record.info !== null
          ? (record.info as Record<string, unknown>)
          : record;

      const eventName =
        (typeof record.event === 'string' ? record.event : undefined) ||
        (typeof info.event === 'string' ? info.event : undefined);

      if (eventName === 'onReady' || eventName === 'initialDelivery') {
        setIsIframeReady(true);
      }

      const payloadVideoId =
        (typeof record.videoId === 'string' ? record.videoId : undefined) ||
        (typeof info.videoId === 'string' ? info.videoId : undefined) ||
        (typeof (info.videoData as Record<string, unknown> | undefined)
          ?.video_id === 'string'
          ? ((info.videoData as Record<string, unknown>).video_id as string)
          : undefined);

      if (payloadVideoId && payloadVideoId !== video.videoId) {
        return;
      }

      if (
        record.event === 'onError' ||
        info.event === 'onError' ||
        typeof record.error === 'number' ||
        typeof info.error === 'number'
      ) {
        handleMarkUnavailable(
          'Embedded playback is restricted for this video.',
        );
        return;
      }

      const rawDuration =
        typeof info.duration === 'number'
          ? info.duration
          : typeof info.durationSeconds === 'number'
            ? info.durationSeconds
            : undefined;

      if (typeof rawDuration === 'number' && rawDuration > 0) {
        lastDurationRef.current = rawDuration;
      }

      const duration = rawDuration ?? lastDurationRef.current;

      const currentTime =
        typeof info.currentTime === 'number'
          ? info.currentTime
          : typeof info.currentTimeSeconds === 'number'
            ? info.currentTimeSeconds
            : undefined;

      if (typeof currentTime === 'number' && typeof duration === 'number') {
        handleNearEndCheck(currentTime, duration);
      }
    };

    const handleCustomProgress = (e: Event) => {
      const customEvt = e as CustomEvent<{
        videoId?: string;
        currentTime?: number;
        duration?: number;
      }>;
      if (!customEvt.detail || customEvt.detail.videoId !== video.videoId) {
        return;
      }
      const { currentTime, duration } = customEvt.detail;
      if (typeof currentTime === 'number' && typeof duration === 'number') {
        handleNearEndCheck(currentTime, duration);
      }
    };

    const handleCustomError = (e: Event) => {
      const customEvt = e as CustomEvent<{ videoId?: string; reason?: string }>;
      if (!customEvt.detail || customEvt.detail.videoId !== video.videoId) {
        return;
      }
      handleMarkUnavailable(customEvt.detail.reason);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('youtube-player-progress', handleCustomProgress);
    window.addEventListener('youtube-player-error', handleCustomError);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener(
        'youtube-player-progress',
        handleCustomProgress,
      );
      window.removeEventListener('youtube-player-error', handleCustomError);
    };
  }, [
    isPlaying,
    isUnavailable,
    video.videoId,
    handleNearEndCheck,
    handleMarkUnavailable,
  ]);

  const handleIframeLoad = useCallback(() => {
    setIsIframeReady(true);
  }, []);

  const handleStartPlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handleIframeError = useCallback(() => {
    handleMarkUnavailable('Failed to load YouTube video embed.');
  }, [handleMarkUnavailable]);

  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(
    video.videoId,
  )}`;

  const originParam =
    typeof window !== 'undefined' && window.location?.origin
      ? encodeURIComponent(window.location.origin)
      : '';

  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    video.videoId,
  )}?enablejsapi=1&rel=0&modestbranding=1&autoplay=1${
    originParam ? `&origin=${originParam}` : ''
  }`;

  if (isUnavailable) {
    return (
      <div
        className={cn(
          'relative flex aspect-video w-full flex-col items-center justify-center rounded-t-lg bg-gray-100 p-4 text-center dark:bg-gray-800',
          className,
        )}
      >
        <AlertCircle className="mb-2 h-8 w-8 text-amber-500" />
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
          Playback unavailable in app
        </p>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {errorMessage ||
            'This video cannot be played in the embedded player.'}
        </p>
        <a
          href={youtubeWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open on YouTube
        </a>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div
        className={cn(
          'relative aspect-video w-full overflow-hidden bg-black',
          className,
        )}
      >
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={`${video.title} - YouTube video player`}
          className="h-full w-full border-0"
          tabIndex={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
        <a
          href={youtubeWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-opacity hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ExternalLink className="h-3 w-3" />
          Open on YouTube
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group/player relative aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800',
        className,
      )}
    >
      {video.thumbnail ? (
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform group-hover/player:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-800">
          <span className="text-3xl" aria-hidden="true">
            ▶
          </span>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover/player:bg-black/30">
        <Button
          type="button"
          size="icon"
          onClick={handleStartPlay}
          className="h-12 w-12 rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          aria-label={`Play ${video.title}`}
        >
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </Button>
      </div>

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
  );
}
