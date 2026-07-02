/* eslint-disable import/first */
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@myorganizer/auth', () => ({
  authSession: {},
  resolveOutboundGuard: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardGuard from './DashboardGuard';
import { resolveOutboundGuard } from '@myorganizer/auth';

describe('DashboardGuard', () => {
  const mockResolveOutboundGuard = resolveOutboundGuard as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockClear();
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
});
