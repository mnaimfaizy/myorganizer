/* eslint-disable import/first */
// The navigation seam (../lib/navigation) is mocked at its module boundary.
// jsdom cannot navigate: Location.reload() and Location.assign() are
// non-configurable and only log "Not implemented: navigation", so the component
// cannot be observed through them. Mocking the seam makes each call observable
// and shows which of the two the component chose for the current path.
// The path is set with history.pushState because the component reads
// window.location.pathname when Retry is pressed or `online` fires.
// What reloadPage() and goToDashboard() do in a real browser (reload in place,
// full load of /dashboard) is outside this suite; the e2e spec covers the reload.
const mockReloadPage = jest.fn();
const mockGoToDashboard = jest.fn();

jest.mock('../lib/navigation', () => ({
  reloadPage: () => mockReloadPage(),
  goToDashboard: () => mockGoToDashboard(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OfflinePage } from './OfflinePage';

function setPathname(path: string): void {
  window.history.pushState({}, '', path);
}

describe('OfflinePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPathname('/login');
  });

  afterEach(() => {
    setPathname('/');
  });

  it('should render the offline landmark, heading, explanation and Retry button', () => {
    render(<OfflinePage />);

    expect(screen.getByRole('main')).toHaveAttribute(
      'data-testid',
      'offline-page',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: "You're offline" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/MyOrganiser needs a connection/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should not request navigation on mount', () => {
    render(<OfflinePage />);

    expect(mockReloadPage).not.toHaveBeenCalled();
    expect(mockGoToDashboard).not.toHaveBeenCalled();
  });

  it('should reload the page once when Retry is pressed on a page other than /offline', () => {
    setPathname('/login');
    render(<OfflinePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockReloadPage).toHaveBeenCalledTimes(1);
    expect(mockGoToDashboard).not.toHaveBeenCalled();
  });

  it('should go to the dashboard once when Retry is pressed on /offline', () => {
    setPathname('/offline');
    render(<OfflinePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockGoToDashboard).toHaveBeenCalledTimes(1);
    expect(mockReloadPage).not.toHaveBeenCalled();
  });

  it('should reload the page once when the window online event fires on a page other than /offline', () => {
    setPathname('/login');
    render(<OfflinePage />);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockReloadPage).toHaveBeenCalledTimes(1);
    expect(mockGoToDashboard).not.toHaveBeenCalled();
  });

  it('should go to the dashboard once when the window online event fires on /offline', () => {
    setPathname('/offline');
    render(<OfflinePage />);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockGoToDashboard).toHaveBeenCalledTimes(1);
    expect(mockReloadPage).not.toHaveBeenCalled();
  });

  it('should not request navigation when an online event fires after unmount', () => {
    const { unmount } = render(<OfflinePage />);
    unmount();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockReloadPage).not.toHaveBeenCalled();
    expect(mockGoToDashboard).not.toHaveBeenCalled();
  });
});
