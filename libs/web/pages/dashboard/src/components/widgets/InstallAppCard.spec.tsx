// The install and dismissal hooks are real. They keep module-level state (the
// held beforeinstallprompt event and the cached dismissal), so every test loads
// a fresh module graph and drives the hooks through the browser's own signals:
// the user agent, display-mode, the install prompt event, and localStorage.
//
// React and Testing Library are loaded from that same fresh graph, so the hooks
// and the renderer share one React. Testing Library's auto-cleanup would
// register an afterEach from inside a running test when it is re-evaluated, so
// cleanup runs explicitly in afterEach instead.
import '@testing-library/jest-dom';

process.env.RTL_SKIP_AUTO_CLEANUP = 'true';

type Rtl = typeof import('@testing-library/react');

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.50 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAC_SAFARI_17_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const MAC_SAFARI_16_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';

const STANDALONE_QUERY = '(display-mode: standalone)';
const DISMISSED_KEY = 'myorganizer.install-card.dismissed.v1';
const IOS_SENTENCE =
  "You'll sign in and unlock your vault again inside the installed app.";

let runningInstalled = false;
let loadedRtl: Rtl | null = null;

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === STANDALONE_QUERY && runningInstalled,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
}

function setUserAgent(userAgent: string): void {
  jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

async function loadCard() {
  jest.resetModules();
  const rtl = await import('@testing-library/react');
  loadedRtl = rtl;
  const { InstallAppCard } = await import('./InstallAppCard');
  return { rtl, InstallAppCard };
}

async function mountCard(): Promise<Rtl> {
  const { rtl, InstallAppCard } = await loadCard();
  rtl.render(<InstallAppCard />);
  return rtl;
}

function dispatchInstallPrompt(rtl: Rtl): jest.Mock<Promise<void>, []> {
  const prompt = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    {
      prompt,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    },
  );
  rtl.act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

describe('InstallAppCard', () => {
  beforeEach(() => {
    runningInstalled = false;
    localStorage.clear();
    stubMatchMedia();
  });

  afterEach(() => {
    loadedRtl?.cleanup();
    loadedRtl = null;
    jest.restoreAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
    localStorage.clear();
  });

  describe('on iOS Safari', () => {
    it('should show the Share and Add to Home Screen steps and the vault sign-in note', async () => {
      setUserAgent(IPHONE_SAFARI_UA);

      const rtl = await mountCard();

      const card = rtl.screen.getByTestId('install-app-card');
      expect(
        rtl.within(card).getByText('Install MyOrganiser'),
      ).toBeInTheDocument();

      const steps = rtl
        .within(card)
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatch(
        /^Tap the Share button\s*\.\s*If it isn't in Safari's toolbar, tap\s*•••\s*the More button first\.$/,
      );
      expect(steps[1]).toBe(
        "Choose Add to Home Screen. If it isn't listed, tap More first.",
      );

      expect(rtl.within(card).getByText(IOS_SENTENCE)).toBeInTheDocument();
      expect(
        rtl.within(card).queryByRole('button', { name: 'Install app' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('on macOS Safari', () => {
    it('should show the File menu and Add to Dock steps and the vault sign-in note on Safari 17', async () => {
      setUserAgent(MAC_SAFARI_17_UA);

      const rtl = await mountCard();

      const card = rtl.screen.getByTestId('install-app-card');
      expect(
        rtl.within(card).getByText('Install MyOrganiser'),
      ).toBeInTheDocument();

      const steps = rtl
        .within(card)
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      expect(steps).toEqual([
        "Open the File menu in Safari's menu bar.",
        'Choose Add to Dock.',
      ]);

      expect(rtl.within(card).getByText(IOS_SENTENCE)).toBeInTheDocument();
      expect(
        rtl.within(card).queryByRole('button', { name: 'Install app' }),
      ).not.toBeInTheDocument();
    });

    it('should not render on Safari 16, which has no Add to Dock path', async () => {
      setUserAgent(MAC_SAFARI_16_UA);

      const rtl = await mountCard();

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });
  });

  describe('on Chromium', () => {
    it('should show an Install app button once the browser offers the install prompt', async () => {
      setUserAgent(DESKTOP_CHROME_UA);
      const rtl = await mountCard();
      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();

      dispatchInstallPrompt(rtl);

      const card = rtl.screen.getByTestId('install-app-card');
      expect(
        rtl.within(card).getByRole('button', { name: 'Install app' }),
      ).toBeInTheDocument();
    });

    it('should call the held install prompt once when Install app is clicked', async () => {
      setUserAgent(DESKTOP_CHROME_UA);
      const rtl = await mountCard();
      const prompt = dispatchInstallPrompt(rtl);

      await rtl.act(async () => {
        rtl.fireEvent.click(
          rtl.screen.getByRole('button', { name: 'Install app' }),
        );
      });

      expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('should hide the card once the install prompt has settled', async () => {
      setUserAgent(DESKTOP_CHROME_UA);
      const rtl = await mountCard();
      dispatchInstallPrompt(rtl);

      await rtl.act(async () => {
        rtl.fireEvent.click(
          rtl.screen.getByRole('button', { name: 'Install app' }),
        );
      });

      await rtl.waitFor(() => {
        expect(
          rtl.screen.queryByTestId('install-app-card'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('when the app is already running installed', () => {
    it('should not render on iOS Safari when display-mode is standalone', async () => {
      setUserAgent(IPHONE_SAFARI_UA);
      runningInstalled = true;

      const rtl = await mountCard();

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });

    it('should not render when an install prompt is held but display-mode is standalone', async () => {
      setUserAgent(DESKTOP_CHROME_UA);
      runningInstalled = true;
      const rtl = await mountCard();

      dispatchInstallPrompt(rtl);

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when the browser cannot install the app', () => {
    it('should not render on a desktop browser that offered no install prompt', async () => {
      setUserAgent(DESKTOP_CHROME_UA);

      const rtl = await mountCard();

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });

    it('should not render in Chrome for iOS, which is not Safari', async () => {
      setUserAgent(IPHONE_CHROME_UA);

      const rtl = await mountCard();

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });
  });

  describe('dismissal', () => {
    it('should hide the card and store the dismissal under the versioned key when Dismiss is clicked', async () => {
      setUserAgent(IPHONE_SAFARI_UA);
      const rtl = await mountCard();

      rtl.fireEvent.click(rtl.screen.getByRole('button', { name: 'Dismiss' }));

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
      expect(localStorage.getItem(DISMISSED_KEY)).toBe('true');
    });

    it('should not render on a later visit when the dismissal was already stored', async () => {
      setUserAgent(IPHONE_SAFARI_UA);
      localStorage.setItem(DISMISSED_KEY, 'true');

      const rtl = await mountCard();

      expect(
        rtl.screen.queryByTestId('install-app-card'),
      ).not.toBeInTheDocument();
    });
  });

  describe('copy', () => {
    it('should never mention PWA in the iOS steps or the Install app prompt', async () => {
      setUserAgent(IPHONE_SAFARI_UA);
      const rtl = await mountCard();
      const card = rtl.screen.getByTestId('install-app-card');
      expect(card.textContent).not.toMatch(/PWA/i);

      dispatchInstallPrompt(rtl);

      expect(
        rtl.screen.getByRole('button', { name: 'Install app' }),
      ).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/PWA/i);
    });
  });
});
