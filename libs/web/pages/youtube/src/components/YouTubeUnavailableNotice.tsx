import { Button } from '@myorganizer/web-ui';
import Link from 'next/link';

interface YouTubeUnavailableNoticeProps {
  /** When set, Back to Dashboard uses this handler (OAuth callback uses router.replace). When omitted, navigate with a Link to /dashboard. */
  onBack?: () => void;
}

export function YouTubeUnavailableNotice({
  onBack,
}: YouTubeUnavailableNoticeProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-destructive/10 p-4">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-destructive"
          fill="currentColor"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        YouTube is not available right now
      </h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Please try again later.
      </p>
      {onBack ? (
        <Button type="button" onClick={onBack}>
          Back to Dashboard
        </Button>
      ) : (
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      )}
    </div>
  );
}
