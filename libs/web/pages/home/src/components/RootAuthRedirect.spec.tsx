import { render, screen, waitFor } from '@testing-library/react';

import RootAuthRedirect from './RootAuthRedirect';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockGetAccessToken = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRefresh = jest.fn();
const mockClearAuthSession = jest.fn();

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getCurrentUser: () => mockGetCurrentUser(),
  refresh: () => mockRefresh(),
  clearAuthSession: () => mockClearAuthSession(),
}));

describe('RootAuthRedirect', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockGetAccessToken.mockReset();
    mockGetCurrentUser.mockReset();
    mockRefresh.mockReset();
    mockClearAuthSession.mockReset();
  });

  it('redirects to /dashboard when an access token exists', async () => {
    mockGetAccessToken.mockReturnValue('token-123');
    mockGetCurrentUser.mockReturnValue(undefined);

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByText('landing')).toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('renders landing when there is no token and no stored user', async () => {
    mockGetAccessToken.mockReturnValue(undefined);
    mockGetCurrentUser.mockReturnValue(undefined);

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await screen.findByText('landing');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('refreshes and redirects when stored user exists but no token', async () => {
    mockGetAccessToken.mockReturnValue(undefined);
    mockGetCurrentUser.mockReturnValue({ id: 'u1' });
    mockRefresh.mockResolvedValue({ token: 'new', expiresIn: 1, user: {} });

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard'));
    expect(mockClearAuthSession).not.toHaveBeenCalled();
    expect(screen.queryByText('landing')).toBeNull();
  });

  it('clears session and shows landing when refresh fails', async () => {
    mockGetAccessToken.mockReturnValue(undefined);
    mockGetCurrentUser.mockReturnValue({ id: 'u1' });
    mockRefresh.mockRejectedValue(new Error('expired'));

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await screen.findByText('landing');
    expect(mockClearAuthSession).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
