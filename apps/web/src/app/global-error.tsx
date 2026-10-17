'use client';

import { Button, Card, CardContent, CardTitle } from '@myorganiser/web-ui';

import './global.css';

interface GlobalErrorProps {
  // The error is accepted to match the Next.js contract but never rendered
  // or logged: it can carry messages that include user data.
  error: Error & { digest?: string };
  retry: () => void;
}

// Replaces the root layout when it throws, so this file must supply its own
// document. The root layout's global.css is imported above for the same reason.
export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong | MyOrganiser</title>
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <Card className="w-full max-w-md p-4">
            <CardTitle className="text-lg">Something went wrong</CardTitle>
            <CardContent className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                The app could not load this page. Try again, or go back to your
                dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => retry()}>
                  Try again
                </Button>
                <Button asChild variant="outline">
                  {/* A plain anchor forces a full document load, which rebuilds the
                      root layout that just failed; client-side routing cannot. */}
                  <a href="/dashboard">Go to dashboard</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
