import Link from 'next/link';

export function MobileNumberDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export function MobileNumberDetailNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Mobile number not found.</p>
      <div>
        <Link
          href="/dashboard/mobile-numbers"
          className="text-sm underline-offset-4 hover:underline"
        >
          Back to mobile numbers
        </Link>
      </div>
    </div>
  );
}

export function BackToMobileNumbersLink() {
  return (
    <div>
      <Link
        href="/dashboard/mobile-numbers"
        className="text-sm underline-offset-4 hover:underline"
      >
        Back to mobile numbers
      </Link>
    </div>
  );
}
