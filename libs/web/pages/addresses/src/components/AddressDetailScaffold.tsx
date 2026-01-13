import Link from 'next/link';

export function AddressDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export function AddressDetailNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Address not found.</p>
      <div>
        <Link
          href="/dashboard/addresses"
          className="text-sm underline-offset-4 hover:underline"
        >
          Back to addresses
        </Link>
      </div>
    </div>
  );
}

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
