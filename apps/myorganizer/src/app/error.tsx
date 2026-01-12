'use client';

import { useEffect } from 'react';

import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Intentionally minimal; avoid logging secrets.
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md p-4">
        <CardTitle className="text-lg">Something went wrong</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Please try again. If the problem persists, reload the page.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                reset();
              }}
            >
              Try again
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
