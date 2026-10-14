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
  const { mode, dismissed, install } = useAppInstall();

  // A cancelled prompt keeps the section, with a hint, so the User can still
  // find a way to install (#1129). Any other unavailable state hides it.
  if (mode === 'unavailable' && !dismissed) {
    return null;
  }

  return (
    <Card data-testid="install-app-section" className="p-4">
      <CardTitle className="text-lg">Install MyOrganiser</CardTitle>
      <CardContent className="mt-4 space-y-4">
        {mode === 'unavailable' ? (
          <p className="text-sm text-muted-foreground">
            To install, reload this page, or use your browser&apos;s menu.
          </p>
        ) : (
          <InstallAppInstructions mode={mode} onInstall={install} />
        )}
      </CardContent>
    </Card>
  );
}
