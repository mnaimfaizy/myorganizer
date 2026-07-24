/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@myorganizer/auth', () => ({
  authSession: {},
  getCurrentUser: jest.fn(),
  resolveOutboundGuard: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import type { AuthUser } from '@myorganizer/auth';
import { getCurrentUser, resolveOutboundGuard } from '@myorganizer/auth';
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
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      push: jest.fn(),
    });
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
});
