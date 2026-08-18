import { Button, Card, CardContent } from '@myorganizer/web-ui';
import Link from 'next/link';

export default function YouTubeDataPrivacyClient() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold">
            How we store your YouTube data
          </h1>
          <ul className="mt-4 space-y-3">
            <li className="text-sm text-gray-700 dark:text-gray-300">
              We store <strong>metadata only</strong> — titles, thumbnails,
              video IDs, publish times, duration, and channel info. We never
              store the video files themselves.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Watched</strong> is a simple yes/no marker for what you've
              already seen. It is not a viewing history or analytics feature —
              no progress percentages, watch counts, or archives.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              We keep the <strong>latest 100</strong> Cached Uploads per Enabled
              Channel.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              If you disable a channel, its Cached Uploads and Watched status
              are kept for <strong>30 days</strong>, then permanently deleted.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Disconnecting</strong> your YouTube account deletes all
              YouTube metadata for your account.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              Your <strong>Shorts Daily Budget</strong> is tracked locally in
              your browser, not on our servers.
            </li>
            <li className="text-sm text-gray-700 dark:text-gray-300">
              This YouTube metadata is <strong>not</strong> covered by
              MyOrganizer's Vault or end-to-end encryption — those apply
              elsewhere in the app. (Your YouTube sign-in tokens are still
              encrypted at rest.)
            </li>
          </ul>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/youtube">Back to YouTube</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
