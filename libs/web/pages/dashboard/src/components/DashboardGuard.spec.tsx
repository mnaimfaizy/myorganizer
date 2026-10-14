/* eslint-disable import/first */
const mockReplace = jest.fn();
// Stable router reference, matching next/navigation. A fresh object per call
// would re-run the guard's effects on every render.
const mockRouter = { replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@myorganizer/auth', () => ({
  authSession: {},
  resolveOutboundGuard: jest.fn(),
  onSessionEnded: jest.fn(),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  SessionEndedEvent,
  SessionEndedListener,
} from '@myorganizer/auth';
import DashboardGuard from './DashboardGuard';
import { onSessionEnded, resolveOutboundGuard } from '@myorganizer/auth';

describe('DashboardGuard', () => {
  const mockResolveOutboundGuard = resolveOutboundGuard as jest.Mock;
  const mockOnSessionEnded = onSessionEnded as jest.Mock;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockClear();
    mockOnSessionEnded.mockReturnValue(mockUnsubscribe);
  });

  it('should render children when authenticated', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await screen.findByText('dashboard-content');
    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('should redirect to /login when guest', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'redirect_login' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
  });

  it('does not subscribe to session end while the initial decision is pending', () => {
    mockResolveOutboundGuard.mockImplementation(() => new Promise(() => {}));

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it('does not subscribe to session end when the initial outcome is a login redirect', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'redirect_login' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it.each<SessionEndedEvent['reason']>([
    'refresh_rejected',
    'signed_out_elsewhere',
  ])(
    'removes children and redirects to /login when the session ends (%s)',
    async (reason) => {
      mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      await screen.findByText('dashboard-content');
      expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);

      const listener = mockOnSessionEnded.mock
        .calls[0][0] as SessionEndedListener;

      act(() => {
        listener({ reason });
      });

      expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    },
  );

  it('calls the unsubscribe function returned by onSessionEnded on unmount', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

    const { unmount } = render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await screen.findByText('dashboard-content');
    expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
