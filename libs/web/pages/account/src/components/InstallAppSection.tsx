'use client';

import {
  Card,
  CardContent,
  CardTitle,
  InstallAppInstructions,
  useAppInstall,
} from '@myorganizer/web-ui';

// The permanent install entry. It ignores the dashboard card's dismissal, so a
// User who dismissed the card can still find the steps here.
export function InstallAppSection() {
  const { mode, install } = useAppInstall();

  if (mode === 'unavailable') {
    return null;
  }

  return (
    <Card data-testid="install-app-section" className="p-4">
      <CardTitle className="text-lg">Install the app</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <InstallAppInstructions mode={mode} onInstall={install} />
      </CardContent>
    </Card>
  );
}
