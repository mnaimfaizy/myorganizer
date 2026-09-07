import Link from 'next/link';

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
