'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
} from '@myorganizer/web-ui';
import type { YouTubeSubscription } from '../types';

interface SubscriptionManagerProps {
  subscriptions: YouTubeSubscription[];
  loading: boolean;
  onSync: () => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDisconnect: () => void;
}

export function SubscriptionManager({
  subscriptions,
  loading,
  onSync,
  onToggle,
  onDisconnect,
}: SubscriptionManagerProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <CardTitle>Subscriptions</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={loading}
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
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={sub.enabled}
                    onChange={() => onToggle(sub.id, !sub.enabled)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
