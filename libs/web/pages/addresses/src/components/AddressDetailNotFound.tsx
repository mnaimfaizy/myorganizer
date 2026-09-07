import { BackToAddressesLink } from './BackToAddressesLink';

export function AddressDetailNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Address not found.</p>
      <BackToAddressesLink />
    </div>
  );
}
