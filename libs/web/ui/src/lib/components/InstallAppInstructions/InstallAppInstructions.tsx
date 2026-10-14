import * as React from 'react';
import { Share } from 'lucide-react';

import type { AppInstallMode } from '../../hooks/use-app-install';
import { cn } from '../../utils';
import { Button } from '../Button/Button';

type InstallAppInstructionsMode = Exclude<AppInstallMode, 'unavailable'>;
type SafariInstallMode = Exclude<InstallAppInstructionsMode, 'prompt'>;

export interface InstallAppInstructionsProps {
  /**
   * 'prompt' offers a one-tap install; 'ios' and 'mac-safari' explain the
   * Safari steps.
   */
  mode: InstallAppInstructionsMode;
  onInstall: () => void;
  className?: string;
}

interface InstallStep {
  id: string;
  content: React.ReactNode;
}

const SAFARI_STEPS = {
  ios: [
    {
      id: 'share',
      content: (
        <>
          Tap the Share button{' '}
          <Share
            aria-hidden="true"
            className="inline h-4 w-4 align-text-bottom"
          />
          . If it isn&apos;t in Safari&apos;s toolbar, tap{' '}
          <span aria-hidden="true">•••</span>
          <span className="sr-only">the More button</span> first.
        </>
      ),
    },
    {
      id: 'add-to-home-screen',
      content: (
        <>Choose Add to Home Screen. If it isn&apos;t listed, tap More first.</>
      ),
    },
  ],
  'mac-safari': [
    { id: 'file-menu', content: "Open the File menu in Safari's menu bar." },
    { id: 'add-to-dock', content: 'Choose Add to Dock.' },
  ],
} satisfies Record<SafariInstallMode, InstallStep[]>;

const InstallAppInstructions = React.forwardRef<
  HTMLDivElement,
  InstallAppInstructionsProps
>(({ mode, onInstall, className }, ref) => {
  if (mode === 'prompt') {
    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        <p className="text-sm text-muted-foreground">
          Install MyOrganiser on this device for quicker access, in its own
          window.
        </p>
        <Button onClick={onInstall}>Install app</Button>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('space-y-3', className)}>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {SAFARI_STEPS[mode].map((step) => (
          <li key={step.id}>{step.content}</li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        You&apos;ll sign in and unlock your vault again inside the installed
        app.
      </p>
    </div>
  );
});
InstallAppInstructions.displayName = 'InstallAppInstructions';

export { InstallAppInstructions };
