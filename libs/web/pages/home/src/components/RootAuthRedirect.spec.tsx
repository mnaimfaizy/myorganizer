/* eslint-disable import/first */
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@myorganizer/auth', () => ({
  authSession: {},
  resolveInboundGuard: jest.fn(),
}));

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RootAuthRedirect from './RootAuthRedirect';
import { resolveInboundGuard } from '@myorganizer/auth';

describe('RootAuthRedirect', () => {
  const mockResolveInboundGuard = resolveInboundGuard as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockClear();
  });

  it('should redirect to /dashboard when authenticated', async () => {
    mockResolveInboundGuard.mockResolvedValue({ kind: 'redirect_dashboard' });

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(screen.queryByText('landing')).not.toBeInTheDocument();
  });

  it('should show landing when guest', async () => {
    mockResolveInboundGuard.mockResolvedValue({ kind: 'show_guest' });

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await screen.findByText('landing');
    expect(screen.getByText('landing')).toBeInTheDocument();
  });
});
