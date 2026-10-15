/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@myorganiser/auth', () => ({
  authSession: {},
  getCurrentUser: jest.fn(),
  resolveOutboundGuard: jest.fn(),
  onSessionEnded: jest.fn(),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import type {
  AuthUser,
  SessionEndedEvent,
  SessionEndedListener,
} from '@myorganiser/auth';
import {
  getCurrentUser,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganiser/auth';
import { useRouter } from 'next/navigation';

import AdminGuard from './AdminGuard';

const mockReplace = jest.fn();

const platformAdminUser: AuthUser = {
  id: 'admin-1',
  name: 'Platform Admin',
  email: 'admin@example.com',
  firstName: 'Platform',
  lastName: 'Admin',
  role: 'platform_admin',
  disabled: false,
};

const normalUser: AuthUser = {
  id: 'user-1',
  name: 'Normal User',
  email: 'user@example.com',
  firstName: 'Normal',
  lastName: 'User',
  role: 'user',
  disabled: false,
};

describe('AdminGuard', () => {
  const mockOnSessionEnded = onSessionEnded as jest.Mock;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
    });
    mockOnSessionEnded.mockReturnValue(mockUnsubscribe);
  });

  it('renders null while the guard is resolving', () => {
    (resolveOutboundGuard as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    expect(screen.queryByText('admin-content')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects guests to login and does not render children', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({
      kind: 'redirect_login',
    });

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    expect(screen.queryByText('admin-content')).toBeNull();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects authenticated non-admin users to dashboard', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(normalUser);

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    expect(screen.queryByText('admin-content')).toBeNull();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects to dashboard when allow succeeds but current user is null', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(null);

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.queryByText('admin-content')).toBeNull();
  });

  it('redirects to dashboard when allow succeeds but current user is undefined', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(undefined);

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.queryByText('admin-content')).toBeNull();
  });

  it('renders children for platform admin users without redirecting', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(platformAdminUser);

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('admin-content')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not subscribe to session end while the platform check is pending', () => {
    (resolveOutboundGuard as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    expect(screen.queryByText('admin-content')).toBeNull();
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it('does not subscribe to session end when a non-admin is redirected to dashboard', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(normalUser);

    render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it.each<SessionEndedEvent['reason']>([
    'refresh_rejected',
    'signed_out_elsewhere',
  ])(
    'removes children and redirects to /login when the session ends (%s)',
    async (reason) => {
      (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
      (getCurrentUser as jest.Mock).mockReturnValue(platformAdminUser);

      render(
        <AdminGuard>
          <div>admin-content</div>
        </AdminGuard>,
      );

      await screen.findByText('admin-content');
      expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);

      const listener = mockOnSessionEnded.mock
        .calls[0][0] as SessionEndedListener;

      act(() => {
        listener({ reason });
      });

      expect(screen.queryByText('admin-content')).toBeNull();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    },
  );

  it('calls the unsubscribe function returned by onSessionEnded on unmount', async () => {
    (resolveOutboundGuard as jest.Mock).mockResolvedValue({ kind: 'allow' });
    (getCurrentUser as jest.Mock).mockReturnValue(platformAdminUser);

    const { unmount } = render(
      <AdminGuard>
        <div>admin-content</div>
      </AdminGuard>,
    );

    await screen.findByText('admin-content');
    expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
