'use client';

import { startAppInstallCapture } from '@myorganizer/web-ui';
import { useEffect } from 'react';

// Mounted from the root layout so the install-prompt listener is in place on
// every page. The browser fires beforeinstallprompt once, early, and it can
// arrive before the dashboard mounts. Renders nothing.
export function InstallPromptCapture() {
  useEffect(() => {
    startAppInstallCapture();
  }, []);

  return null;
}
