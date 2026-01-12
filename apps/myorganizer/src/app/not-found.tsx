import Link from 'next/link';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md p-4">
        <CardTitle className="text-lg">Page not found</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            The page you’re looking for doesn’t exist.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
