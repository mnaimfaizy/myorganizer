'use client';

import { Button } from '@myorganizer/web-ui';
import Link from 'next/link';

interface YouTubeConnectPromptProps {
  /**
   * Optional connect handler. If provided, the button will call it instead of
   * navigating. Used by YouTubePageClient to trigger the OAuth flow.
   */
  onConnect?: () => void;

  /**
   * Optional status message or variant. Used to show "revoked" state in
   * YouTubePageClient. Rendered as a note below the main text.
   */
  statusMessage?: React.ReactNode;

  /**
   * Optional fallback link destination when onConnect is not provided.
   * If not provided and onConnect is absent, defaults to "/dashboard/youtube".
   */
  fallbackHref?: string;
}

/**
 * Shared connect prompt shown when YouTube is not connected.
 *
 * Used by both YouTubePageClient (with onConnect callback and status message)
 * and ShortsPageClient (without onConnect, linking back to /dashboard/youtube).
 *
 * The YouTube SVG icon, layout, and messaging are consistent across both.
 */
export function YouTubeConnectPrompt({
  onConnect,
  statusMessage,
  fallbackHref = '/dashboard/youtube',
}: YouTubeConnectPromptProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-red-600 dark:text-red-400"
          fill="currentColor"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Connect Your YouTube Account
      </h2>
      <p className="max-w-md text-center text-sm text-gray-500">
        Link your YouTube account to view and manage videos from your Enabled
        Channels. We only request read-only access.
      </p>
      <div className="max-w-md text-center text-sm text-gray-500">
        <ul className="list-disc list-inside space-y-1 mb-2 inline-block text-left">
          <li>Metadata only — never video files</li>
          <li>Watched is yes/no, not analytics</li>
          <li>Latest 100 uploads cached per channel</li>
          <li>30 days after you disable a channel</li>
          <li>Disconnecting deletes all metadata</li>
          <li>Shorts budget is tracked locally</li>
        </ul>
      </div>
      <Link
        href="/youtube/data-privacy"
        className="text-xs underline text-gray-500 dark:text-gray-400"
      >
        How we store your YouTube data
      </Link>
      {statusMessage && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          {statusMessage}
        </p>
      )}
      {onConnect ? (
        <Button onClick={onConnect}>Connect YouTube</Button>
      ) : (
        <Button asChild>
          <Link href={fallbackHref}>Back to Videos</Link>
        </Button>
      )}
    </div>
  );
}
