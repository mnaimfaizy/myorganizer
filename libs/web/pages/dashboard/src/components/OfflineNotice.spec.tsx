import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import { OfflineNotice } from './OfflineNotice';

const OFFLINE_COPY =
  "You're offline. Vault changes are saved on this device and sync when you reconnect. Other changes need a connection.";

describe('OfflineNotice', () => {
  let onlineSpy: jest.SpyInstance<boolean, []>;

  // Drives the real useOnlineStatus hook through the browser's own signals:
  // the navigator getter, then the window event it would fire.
  function goOffline() {
    onlineSpy.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
  }

  function goOnline() {
    onlineSpy.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
  }

  beforeEach(() => {
    onlineSpy = jest
      .spyOn(window.navigator, 'onLine', 'get')
      .mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders no visible bar while online, with an empty live status region', () => {
    render(<OfflineNotice />);

    expect(screen.queryByTestId('offline-notice')).not.toBeInTheDocument();

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.textContent).toBe('');
  });

  it('shows the bar and announces the copy when the browser goes offline', () => {
    render(<OfflineNotice />);

    goOffline();

    const notice = screen.getByTestId('offline-notice');
    expect(within(notice).getByText(OFFLINE_COPY)).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe(OFFLINE_COPY);
  });

  it('removes the bar and empties the status region when the browser comes back online', () => {
    render(<OfflineNotice />);
    const statusBefore = screen.getByRole('status');

    goOffline();
    expect(screen.getByTestId('offline-notice')).toBeInTheDocument();

    goOnline();

    expect(screen.queryByTestId('offline-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('');
    // The live region must stay mounted across the transition; a polite
    // region only announces changes to a node it already contains.
    expect(screen.getByRole('status')).toBe(statusBefore);
  });

  it('renders the bar immediately when the browser is offline at mount', () => {
    onlineSpy.mockReturnValue(false);

    render(<OfflineNotice />);

    const notice = screen.getByTestId('offline-notice');
    expect(within(notice).getByText(OFFLINE_COPY)).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe(OFFLINE_COPY);
  });

  it('does not move focus away from the page when it appears', () => {
    render(
      <>
        <button type="button">Beside the notice</button>
        <OfflineNotice />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Beside the notice' });
    button.focus();
    expect(document.activeElement).toBe(button);

    goOffline();

    expect(document.activeElement).toBe(button);
    const notice = screen.getByTestId('offline-notice');
    expect(
      notice.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]',
      ),
    ).toHaveLength(0);
  });

  it('hides the visible bar from assistive tech and merges className onto it', () => {
    onlineSpy.mockReturnValue(false);

    render(<OfflineNotice className="custom-notice-class" />);

    const notice = screen.getByTestId('offline-notice');
    expect(notice).toHaveAttribute('aria-hidden', 'true');
    expect(notice).toHaveClass('custom-notice-class');
    expect(notice).toHaveClass('flex');
  });
});
