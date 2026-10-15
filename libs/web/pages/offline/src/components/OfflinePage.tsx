'use client';

import { useCallback, useEffect } from 'react';

import {
  AppLogo,
  Button,
  Card,
  CardContent,
  CardTitle,
} from '@myorganiser/web-ui';

import { goToDashboard, reloadPage } from '../lib/navigation';

// Served from the service worker cache at whatever URL the user asked for, so
// this component must render with no network and no User data. Do not add
// session, vault, API, router, link, or image imports here. Navigation goes
// through ../lib/navigation (hard document loads, no router) so tests can mock it.
export function OfflinePage() {
  // Shared by the Retry button and the window `online` event. Reloading the
  // requested page is the whole recovery; `/offline` itself is never a useful
  // target, so a direct visit to it goes to the dashboard instead.
  const retry = useCallback(() => {
    if (window.location.pathname === '/offline') {
      goToDashboard();
      return;
    }
    reloadPage();
  }, []);

  useEffect(() => {
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [retry]);

  return (
    <main
      data-testid="offline-page"
      className="flex min-h-screen items-center justify-center bg-background p-6"
    >
      <Card className="w-full max-w-md p-4">
        <CardTitle className="text-lg">
          <h1>You&apos;re offline</h1>
        </CardTitle>
        <CardContent className="mt-4 space-y-4">
          <AppLogo variant="full" />
          <p className="text-sm text-muted-foreground">
            MyOrganiser needs a connection. Check your connection and try again
            — this page reloads on its own when you&apos;re back online.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={retry}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
