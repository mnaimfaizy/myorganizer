'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@myorganizer/web-ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRetryAt, isRetryCooldownActive } from '../hooks';
import type { YouTubeSubscription } from '../types';

interface SubscriptionManagerProps {
  subscriptions: YouTubeSubscription[];
  loading: boolean;
  onSync: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDisconnect: () => void;
  syncRetryAt?: string | null;
}

export function SubscriptionManager({
  subscriptions,
  loading,
  onSync,
  onToggle,
  onDisconnect,
  syncRetryAt,
}: SubscriptionManagerProps) {
  const router = useRouter();
  const isCooldownActive = !!(
    syncRetryAt && isRetryCooldownActive(syncRetryAt)
  );
  const retryLabel = formatRetryAt(syncRetryAt);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <CardTitle>Subscriptions</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isCooldownActive) return;
              onSync();
            }}
            disabled={loading || isCooldownActive}
            aria-label={
              isCooldownActive && retryLabel
                ? `Sync disabled until ${retryLabel}`
                : undefined
            }
            title={
              isCooldownActive && retryLabel
                ? `Sync disabled until ${retryLabel}`
                : undefined
            }
          >
            {loading ? 'Syncing…' : 'Sync from YouTube'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            className="text-red-600 hover:text-red-700"
          >
            Disconnect
          </Button>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <ul className="list-disc list-inside space-y-0.5 mb-2">
          <li>Metadata only — never video files</li>
          <li>Watched is yes/no, not analytics</li>
          <li>Latest 100 uploads cached per channel</li>
          <li>30 days after you disable a channel</li>
          <li>Disconnecting deletes all metadata</li>
          <li>Shorts budget is tracked locally</li>
        </ul>
        <Link href="/youtube/data-privacy" className="underline">
          How we store your data
        </Link>
      </div>
      <CardContent className="mt-4">
        {loading && subscriptions.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            No subscriptions found. Click &quot;Sync from YouTube&quot; to
            import your channels.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() =>
                    router.push(
                      `/dashboard/youtube?channel=${encodeURIComponent(sub.channelId)}`,
                    )
                  }
                >
                  {sub.channelThumbnail ? (
                    <img
                      src={sub.channelThumbnail}
                      alt={sub.channelTitle}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold dark:bg-gray-700">
                      {sub.channelTitle.charAt(0)}
                    </div>
                  )}
                  <span className="flex-1 truncate text-sm font-medium">
                    {sub.channelTitle}
                  </span>
                </button>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={sub.enabled}
                    onChange={() => onToggle(sub.id, !sub.enabled)}
                    className="peer sr-only"
                    aria-label={`Toggle subscription for ${sub.channelTitle}`}
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
