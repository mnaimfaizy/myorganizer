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
const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAC_SAFARI_17_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

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

async function mountSection(): Promise<Rtl> {
  jest.resetModules();
  const rtl = await import('@testing-library/react');
  loadedRtl = rtl;
  const { InstallAppSection } = await import('./InstallAppSection');
  rtl.render(<InstallAppSection />);
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

describe('InstallAppSection', () => {
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

  it('should show the Install the app section with the iOS steps and vault sign-in note on iOS Safari', async () => {
    setUserAgent(IPHONE_SAFARI_UA);

    const rtl = await mountSection();

    const section = rtl.screen.getByTestId('install-app-section');
    expect(
      rtl.within(section).getByText('Install the app'),
    ).toBeInTheDocument();

    const steps = rtl
      .within(section)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatch(
      /^Tap the Share button\s*\.\s*If it isn't in Safari's toolbar, tap\s*•••\s*the More button first\.$/,
    );
    expect(steps[1]).toBe(
      "Choose Add to Home Screen. If it isn't listed, tap More first.",
    );
    expect(rtl.within(section).getByText(IOS_SENTENCE)).toBeInTheDocument();
    expect(
      rtl.within(section).queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('should show the File menu and Add to Dock steps and the vault sign-in note on macOS Safari 17', async () => {
    setUserAgent(MAC_SAFARI_17_UA);

    const rtl = await mountSection();

    const section = rtl.screen.getByTestId('install-app-section');
    expect(
      rtl.within(section).getByText('Install the app'),
    ).toBeInTheDocument();

    const steps = rtl
      .within(section)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(steps).toEqual([
      "Open the File menu in Safari's menu bar.",
      'Choose Add to Dock.',
    ]);
    expect(rtl.within(section).getByText(IOS_SENTENCE)).toBeInTheDocument();
    expect(
      rtl.within(section).queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
  });

  it('should show an Install app button on Chromium once the install prompt is held', async () => {
    setUserAgent(DESKTOP_CHROME_UA);
    const rtl = await mountSection();
    expect(
      rtl.screen.queryByTestId('install-app-section'),
    ).not.toBeInTheDocument();

    dispatchInstallPrompt(rtl);

    const section = rtl.screen.getByTestId('install-app-section');
    expect(
      rtl.within(section).getByRole('button', { name: 'Install app' }),
    ).toBeInTheDocument();
  });

  it('should call the held install prompt once when Install app is clicked', async () => {
    setUserAgent(DESKTOP_CHROME_UA);
    const rtl = await mountSection();
    const prompt = dispatchInstallPrompt(rtl);

    await rtl.act(async () => {
      rtl.fireEvent.click(
        rtl.screen.getByRole('button', { name: 'Install app' }),
      );
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('should not render when the app is already running installed', async () => {
    setUserAgent(IPHONE_SAFARI_UA);
    runningInstalled = true;

    const rtl = await mountSection();

    expect(
      rtl.screen.queryByTestId('install-app-section'),
    ).not.toBeInTheDocument();
  });

  it('should not render on a desktop browser that cannot install the app', async () => {
    setUserAgent(DESKTOP_CHROME_UA);

    const rtl = await mountSection();

    expect(
      rtl.screen.queryByTestId('install-app-section'),
    ).not.toBeInTheDocument();
  });

  it('should still render after the dashboard card was dismissed', async () => {
    setUserAgent(IPHONE_SAFARI_UA);
    localStorage.setItem(DISMISSED_KEY, 'true');

    const rtl = await mountSection();

    const section = rtl.screen.getByTestId('install-app-section');
    expect(rtl.within(section).getByText(IOS_SENTENCE)).toBeInTheDocument();
  });
});
