'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InstallAppInstructions,
  useAppInstall,
} from '@myorganizer/web-ui';
import { X } from 'lucide-react';

import { useInstallCardDismissed } from '../../hooks/use-install-card-dismissed';

export function InstallAppCard() {
  const { mode, install } = useAppInstall();
  const { dismissed, dismiss } = useInstallCardDismissed();

  if (mode === 'unavailable' || dismissed) {
    return null;
  }

  return (
    <Card
      data-testid="install-app-card"
      className="md:col-span-4 col-span-full"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Install MyOrganiser
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent>
        <InstallAppInstructions mode={mode} onInstall={install} />
      </CardContent>
    </Card>
  );
}
