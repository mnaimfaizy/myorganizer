type ReactModule = typeof import('react');
type ReactDomClientModule = typeof import('react-dom/client');
type HookModule = typeof import('./use-app-install');
type Outcome = { outcome: 'accepted' | 'dismissed'; platform: string };
type PromptEvent = Event & {
  prompt: jest.Mock;
  userChoice: Promise<Outcome>;
};

const STANDALONE_QUERY = '(display-mode: standalone)';

const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
// iPadOS requests the desktop site, so its Safari reports a Mac user agent.
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const MAC_SAFARI_16_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';
const MAC_SAFARI_17_0_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const MAC_SAFARI_18_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
// An in-app browser on macOS: Safari's engine with a Facebook app token.
const MAC_IN_APP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 FBAV/460.0 Safari/605.1.15';
const MAC_SAFARI_NO_VERSION_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15';
const MAC_WEBKIT_NO_SAFARI_TOKEN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const MAC_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAC_EDGE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80';
const CHROME_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1';

const originalMatchMedia = window.matchMedia;

// Module-level state in use-app-install is reset per test. jest.resetModules()
// gives a fresh module instance, and React and react-dom are loaded after the
// reset too, so every consumer shares one React instance with the hook. A
// static React Testing Library import is avoided here: its afterEach
// auto-cleanup cannot be registered from inside a test.
let reactLib: ReactModule;
let reactDomClient: ReactDomClientModule;
let hook: HookModule;
let mediaQueryAddListener: jest.Mock;
const cleanups: Array<() => void> = [];

async function loadFreshModules(): Promise<void> {
  jest.resetModules();
  reactLib = await import('react');
  reactDomClient = await import('react-dom/client');
  hook = await import('./use-app-install');
}

function renderHook<T>(useHookUnderTest: () => T): {
  readonly result: { readonly current: T };
} {
  let latest!: T;
  function Probe(): null {
    const value = useHookUnderTest();
    reactLib.useLayoutEffect(() => {
      latest = value;
    });
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = reactDomClient.createRoot(container);
  const reactAct = reactLib.act;
  reactAct(() => {
    root.render(reactLib.createElement(Probe));
  });
  cleanups.push(() => {
    reactAct(() => {
      root.unmount();
    });
    container.remove();
  });
  return {
    result: {
      get current() {
        return latest;
      },
    },
  };
}

function setUserAgent(userAgent: string): void {
  jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

function setNavigatorProperty(
  name: 'maxTouchPoints' | 'standalone',
  value: number | boolean,
): void {
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  });
}

function setDisplayModeStandalone(standalone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: standalone && query === STANDALONE_QUERY,
      media: query,
      addEventListener: mediaQueryAddListener,
      removeEventListener: jest.fn(),
    }),
  });
}

// Safari before 14 exposes matchMedia without addEventListener on the query list.
function setMatchMediaWithoutListener(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      removeEventListener: jest.fn(),
    }),
  });
}

function createPromptEvent(
  options: { prompt?: jest.Mock; userChoice?: Promise<Outcome> } = {},
): PromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(event, {
    prompt: options.prompt ?? jest.fn(() => Promise.resolve()),
    userChoice:
      options.userChoice ??
      Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  });
}

function dispatchWindowEvent(event: Event): void {
  reactLib.act(() => {
    window.dispatchEvent(event);
  });
}

describe('useAppInstall', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.localStorage.clear();
    mediaQueryAddListener = jest.fn();
    setDisplayModeStandalone(false);
    setUserAgent(DESKTOP_CHROME_UA);
    setNavigatorProperty('maxTouchPoints', 0);
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    jest.restoreAllMocks();
    Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
    Reflect.deleteProperty(window.navigator, 'standalone');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    window.localStorage.clear();
  });

  describe('install mode', () => {
    it('should report unavailable before a prompt is captured and prompt once beforeinstallprompt fires on a mounted consumer', async () => {
      await loadFreshModules();
      const { result } = renderHook(() => hook.useAppInstall());
      expect(result.current.mode).toBe('unavailable');

      const event = createPromptEvent();
      dispatchWindowEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(result.current.mode).toBe('prompt');
    });

    it('should report prompt to a consumer mounted after beforeinstallprompt has already fired', async () => {
      await loadFreshModules();
      dispatchWindowEvent(createPromptEvent());

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('prompt');
    });

    it('should call the held prompt once and report unavailable when the user accepts', async () => {
      await loadFreshModules();
      let resolveChoice: (choice: Outcome) => void = () => undefined;
      const event = createPromptEvent({
        userChoice: new Promise<Outcome>((resolve) => {
          resolveChoice = resolve;
        }),
      });
      dispatchWindowEvent(event);
      const { result } = renderHook(() => hook.useAppInstall());

      let installing: Promise<void> = Promise.resolve();
      reactLib.act(() => {
        installing = result.current.install();
      });
      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('prompt');

      await reactLib.act(async () => {
        resolveChoice({ outcome: 'accepted', platform: 'web' });
        await installing;
      });

      expect(result.current.mode).toBe('unavailable');
      expect(result.current.dismissed).toBe(false);
    });

    it('should call the held prompt once and report unavailable and dismissed when the user dismisses it', async () => {
      await loadFreshModules();
      const event = createPromptEvent({
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
      dispatchWindowEvent(event);
      const { result } = renderHook(() => hook.useAppInstall());

      await reactLib.act(async () => {
        await result.current.install();
      });

      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('unavailable');
      expect(result.current.dismissed).toBe(true);
    });

    it('should resolve without throwing and leave the mode unchanged when install is called with no held prompt', async () => {
      await loadFreshModules();
      const { result } = renderHook(() => hook.useAppInstall());

      await reactLib.act(async () => {
        await expect(result.current.install()).resolves.toBeUndefined();
      });

      expect(result.current.mode).toBe('unavailable');
    });

    it('should resolve without throwing and drop the event when prompt() rejects', async () => {
      await loadFreshModules();
      const event = createPromptEvent({
        prompt: jest.fn(() => Promise.reject(new Error('Prompt refused'))),
      });
      dispatchWindowEvent(event);
      const { result } = renderHook(() => hook.useAppInstall());

      await reactLib.act(async () => {
        await expect(result.current.install()).resolves.toBeUndefined();
      });
      await reactLib.act(async () => {
        await result.current.install();
      });

      expect(result.current.mode).toBe('unavailable');
      expect(event.prompt).toHaveBeenCalledTimes(1);
    });

    it('should call prompt once when install is called again while the first prompt is pending', async () => {
      await loadFreshModules();
      let finishPrompt: () => void = () => undefined;
      const event = createPromptEvent({
        prompt: jest.fn(
          () =>
            new Promise<void>((resolve) => {
              finishPrompt = () => resolve();
            }),
        ),
      });
      dispatchWindowEvent(event);
      const { result } = renderHook(() => hook.useAppInstall());

      await reactLib.act(async () => {
        const first = result.current.install();
        const second = result.current.install();
        finishPrompt();
        await Promise.all([first, second]);
      });

      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('unavailable');
    });

    it('should leave prompt mode when the browser reports appinstalled', async () => {
      await loadFreshModules();
      dispatchWindowEvent(createPromptEvent());
      const { result } = renderHook(() => hook.useAppInstall());
      expect(result.current.mode).toBe('prompt');

      dispatchWindowEvent(new Event('appinstalled'));

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report ios when the user agent is iPhone Safari', async () => {
      setUserAgent(IPHONE_SAFARI_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('ios');
    });

    it('should report ios when a Mac user agent comes with touch points, as iPadOS Safari does', async () => {
      setUserAgent(MAC_SAFARI_UA);
      setNavigatorProperty('maxTouchPoints', 5);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('ios');
    });

    it('should report mac-safari when Safari 17.4 runs on a Mac without touch points', async () => {
      setUserAgent(MAC_SAFARI_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('mac-safari');
    });

    it('should report mac-safari at the Safari 17.0 boundary on a Mac without touch points', async () => {
      setUserAgent(MAC_SAFARI_17_0_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('mac-safari');
    });

    it('should report mac-safari when Safari 18 runs on a Mac without touch points', async () => {
      setUserAgent(MAC_SAFARI_18_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('mac-safari');
    });

    it('should report unavailable when an in-app browser on a Mac runs Safari engine without touch points', async () => {
      setUserAgent(MAC_IN_APP_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when an in-app browser on an iPad reporting as a Mac is turned away by both checks', async () => {
      setUserAgent(MAC_IN_APP_UA);
      setNavigatorProperty('maxTouchPoints', 5);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when a Mac Safari user agent omits its version', async () => {
      setUserAgent(MAC_SAFARI_NO_VERSION_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when a Mac WebKit user agent has no Safari token', async () => {
      setUserAgent(MAC_WEBKIT_NO_SAFARI_TOKEN_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when Chrome runs on iOS, which is not Safari', async () => {
      setUserAgent(CHROME_IOS_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when Safari 16 runs on a Mac, which has no Add to Dock path', async () => {
      setUserAgent(MAC_SAFARI_16_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when desktop Chrome runs on a Mac, before any prompt event', async () => {
      setUserAgent(MAC_CHROME_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when Edge runs on a Mac', async () => {
      setUserAgent(MAC_EDGE_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when Safari 17 on a Mac is running standalone', async () => {
      setDisplayModeStandalone(true);
      setUserAgent(MAC_SAFARI_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when display-mode is standalone, even on iPhone Safari with a held prompt', async () => {
      setDisplayModeStandalone(true);
      setUserAgent(IPHONE_SAFARI_UA);
      await loadFreshModules();
      dispatchWindowEvent(createPromptEvent());

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });

    it('should report unavailable when navigator.standalone is true on iPhone Safari', async () => {
      setNavigatorProperty('standalone', true);
      setUserAgent(IPHONE_SAFARI_UA);
      await loadFreshModules();

      const { result } = renderHook(() => hook.useAppInstall());

      expect(result.current.mode).toBe('unavailable');
    });
  });

  describe('dismissal', () => {
    async function dismissHeldPrompt() {
      await loadFreshModules();
      dispatchWindowEvent(
        createPromptEvent({
          userChoice: Promise.resolve({
            outcome: 'dismissed',
            platform: 'web',
          }),
        }),
      );
      const consumer = renderHook(() => hook.useAppInstall());
      await reactLib.act(async () => {
        await consumer.result.current.install();
      });
      return consumer;
    }

    it('should clear the dismissal and offer the prompt again when a new beforeinstallprompt fires', async () => {
      const { result } = await dismissHeldPrompt();
      expect(result.current.dismissed).toBe(true);

      dispatchWindowEvent(createPromptEvent());

      expect(result.current.dismissed).toBe(false);
      expect(result.current.mode).toBe('prompt');
    });

    it('should clear the dismissal when the browser reports appinstalled', async () => {
      const { result } = await dismissHeldPrompt();
      expect(result.current.dismissed).toBe(true);

      dispatchWindowEvent(new Event('appinstalled'));

      expect(result.current.dismissed).toBe(false);
      expect(result.current.mode).toBe('unavailable');
    });

    it('should report the dismissal to a consumer mounted after the prompt was dismissed', async () => {
      await dismissHeldPrompt();

      const late = renderHook(() => hook.useAppInstall());

      expect(late.result.current.dismissed).toBe(true);
      expect(late.result.current.mode).toBe('unavailable');
    });
  });

  describe('startAppInstallCapture', () => {
    it('should register each capture listener once across module load and repeated calls', async () => {
      const addSpy = jest.spyOn(window, 'addEventListener');
      await loadFreshModules();

      hook.startAppInstallCapture();
      hook.startAppInstallCapture();

      const registrations = (type: string) =>
        addSpy.mock.calls.filter(([eventType]) => eventType === type).length;
      expect(registrations('beforeinstallprompt')).toBe(1);
      expect(registrations('appinstalled')).toBe(1);
      expect(mediaQueryAddListener).toHaveBeenCalledTimes(1);
      expect(mediaQueryAddListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should load without throwing and still report a mode when the media query list has no addEventListener', async () => {
      setMatchMediaWithoutListener();
      setUserAgent(IPHONE_SAFARI_UA);

      await expect(loadFreshModules()).resolves.toBeUndefined();

      const { result } = renderHook(() => hook.useAppInstall());
      expect(result.current.mode).toBe('ios');
    });
  });
});
