import * as React from 'react';

export type AppInstallMode = 'prompt' | 'ios' | 'mac-safari' | 'unavailable';

// lib.dom does not type the install prompt, so its shape is declared here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// iOS Safari sets this non-standard flag on standalone launches; lib.dom does
// not type it.
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const STANDALONE_QUERY = '(display-mode: standalone)';

// The browser fires beforeinstallprompt once, early, and it can be a single
// event per page load. It is held here until the user chooses to install.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let promptInFlight = false;
let captureStarted = false;
// True once the User cancelled the browser's prompt in this page session. It is
// cleared when a new prompt is captured or the app is installed (#1129).
let installDismissed = false;
const installListeners = new Set<() => void>();

function emitInstallChange(): void {
  installListeners.forEach((listener) => listener());
}

function subscribeInstall(onStoreChange: () => void): () => void {
  installListeners.add(onStoreChange);
  return () => {
    installListeners.delete(onStoreChange);
  };
}

function isStandalone(): boolean {
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(STANDALONE_QUERY).matches
  ) {
    return true;
  }
  return (navigator as NavigatorWithStandalone).standalone === true;
}

const IOS_DEVICE = /iPhone|iPod|iPad/;
// Other iOS browsers run on WebKit and carry Safari in their user agent, so
// they are excluded by their own tokens. The list is the cheap, known set.
const NOT_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|GSA\/|DuckDuckGo/;

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS requests the desktop site by default and reports as a Mac with
  // touch points, so the Mac token alone is not enough.
  const iosDevice =
    IOS_DEVICE.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!iosDevice) return false;
  if (NOT_SAFARI.test(ua)) return false;
  return /Safari/.test(ua);
}

const MAC_DEVICE = /Macintosh/;
// Desktop Chrome and other macOS browsers carry Safari in their user agent too,
// so their own tokens are what separate them from Safari itself. The iOS list
// is included, so an iPad browser that isIosSafari turned away (iPadOS reports
// as a Mac) is turned away here as well.
const NOT_SAFARI_MAC = new RegExp(
  `${NOT_SAFARI.source}|Chrome|Chromium|Edg|OPR|Firefox|Brave|Vivaldi|Electron`,
);
// File → Add to Dock arrived in Safari 17; older Safari has no install path.
const MAC_SAFARI_ADD_TO_DOCK_VERSION = 17;

function isMacSafari(): boolean {
  const ua = navigator.userAgent;
  if (!MAC_DEVICE.test(ua)) return false;
  if (NOT_SAFARI_MAC.test(ua)) return false;
  if (!/Safari\//.test(ua)) return false;
  const version = /Version\/(\d+)/.exec(ua);
  return (
    version !== null && Number(version[1]) >= MAC_SAFARI_ADD_TO_DOCK_VERSION
  );
}

function computeInstallMode(): AppInstallMode {
  if (typeof window === 'undefined') return 'unavailable';
  if (isStandalone()) return 'unavailable';
  if (deferredPrompt) return 'prompt';
  if (isIosSafari()) return 'ios';
  if (isMacSafari()) return 'mac-safari';
  return 'unavailable';
}

function getInstallSnapshot(): AppInstallMode {
  return computeInstallMode();
}

// Server and hydration render nothing, so the server output never mismatches
// the client's first render. The real reading arrives after hydration.
function getServerInstallSnapshot(): AppInstallMode {
  return 'unavailable';
}

function getDismissedSnapshot(): boolean {
  return installDismissed;
}

function getServerDismissedSnapshot(): boolean {
  return false;
}

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  installDismissed = false;
  emitInstallChange();
}

function handleAppInstalled(): void {
  deferredPrompt = null;
  installDismissed = false;
  emitInstallChange();
}

/**
 * Registers the browser listeners that capture the install prompt. Safe to
 * call more than once: the listeners are added a single time.
 */
export function startAppInstallCapture(): void {
  if (captureStarted || typeof window === 'undefined') return;
  captureStarted = true;
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  if (typeof window.matchMedia === 'function') {
    // Optional call: Safari before 14 has no addEventListener on a media
    // query list, and this runs at module load, where a throw would take
    // every importer of the library down with it.
    window
      .matchMedia(STANDALONE_QUERY)
      .addEventListener?.('change', emitInstallChange);
  }
}

async function installApp(): Promise<void> {
  const event = deferredPrompt;
  if (!event || promptInFlight) return;
  promptInFlight = true;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'dismissed') {
      installDismissed = true;
    }
  } catch {
    // The browser refused or abandoned the prompt. The event can prompt only
    // once, so it is spent whichever way this ends.
  } finally {
    deferredPrompt = null;
    promptInFlight = false;
    emitInstallChange();
  }
}

/**
 * How this browser can install the app right now, and a way to start the
 * install. `mode` is `'unavailable'` when the app is already installed, or
 * when the browser offers no install path. `dismissed` is true when the User
 * cancelled the browser's install prompt in this page session; an accepted
 * prompt never sets it.
 */
export function useAppInstall(): {
  mode: AppInstallMode;
  dismissed: boolean;
  install: () => Promise<void>;
} {
  const mode = React.useSyncExternalStore(
    subscribeInstall,
    getInstallSnapshot,
    getServerInstallSnapshot,
  );
  const dismissed = React.useSyncExternalStore(
    subscribeInstall,
    getDismissedSnapshot,
    getServerDismissedSnapshot,
  );
  return { mode, dismissed, install: installApp };
}

// Runs at module load, not on mount. The browser's beforeinstallprompt can
// fire before any consumer exists, and a listener added later would miss it.
// Kept last so the store above is initialised before it runs.
if (typeof window !== 'undefined') {
  startAppInstallCapture();
}
