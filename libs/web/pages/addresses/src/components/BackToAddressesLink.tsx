import Link from 'next/link';

export function BackToAddressesLink() {
  return (
    <div>
      <Link
        href="/dashboard/addresses"
        className="text-sm underline-offset-4 hover:underline"
      >
        Back to addresses
      </Link>
    </div>
  );
}
