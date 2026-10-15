import { Button, Card, CardContent } from '@myorganizer/web-ui';
import Link from 'next/link';

export function AccountDeletedPage() {
  return (
    <div
      data-testid="account-deleted"
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
    >
      <Card className="w-full max-w-xl">
        <CardContent className="flex flex-col gap-4 pt-6">
          <h1 className="text-lg font-semibold">
            Your account has been deleted
          </h1>
          <p className="text-sm text-muted-foreground">
            Your account and everything stored on our servers for it are gone,
            including your encrypted vault. All of its Sessions have been signed
            out.
          </p>
          <p className="text-sm text-muted-foreground">
            A confirmation email is on its way to the address on the account.
          </p>
          <p className="text-sm text-muted-foreground">
            An Escape Copy you downloaded before deleting is still yours. It
            does not depend on MyOrganizer to open.
          </p>
          <div className="flex justify-center pt-2">
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
