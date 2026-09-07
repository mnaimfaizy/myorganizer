import { BackToMobileNumbersLink } from './BackToMobileNumbersLink';

export function MobileNumberDetailNotFound() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <p className="text-sm text-muted-foreground">Mobile number not found.</p>
      <BackToMobileNumbersLink />
    </div>
  );
}
