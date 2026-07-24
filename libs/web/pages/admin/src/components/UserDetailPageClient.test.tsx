/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('../lib/apiClient', () => ({
  createPlatformAdminApi: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}));

jest.mock('next/link', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement('a', { href, ...props }, children),
  };
});

import type { AdminUserIdentity } from '@myorganizer/app-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useParams } from 'next/navigation';

import { createPlatformAdminApi } from '../lib/apiClient';

import { UserDetailPageClient } from './UserDetailPageClient';

const mockGetUserById = jest.fn();

const userWithPhone: AdminUserIdentity = {
  id: 'u-2',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  firstName: 'Grace',
  lastName: 'Hopper',
  phone: '+1-555-0100',
  role: 'user',
  disabled: true,
  emailVerified: false,
};

const userWithoutPhone: AdminUserIdentity = {
  id: 'u-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'platform_admin',
  disabled: false,
  emailVerified: true,
};

const SENSITIVE_PATTERNS = [
  /vault/i,
  /youtube/i,
  /password/i,
  /ciphertext/i,
  /unlock/i,
  /subscription sync/i,
  /oauth token/i,
  /master key/i,
];

function expectNoSensitiveContent(container: HTMLElement) {
  const text = container.textContent?.toLowerCase() ?? '';

  for (const pattern of SENSITIVE_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

function expectDefinitionValue(label: string, value: string) {
  const term = screen.getByText(label);
  const definition = term.nextElementSibling;

  expect(definition).toHaveTextContent(value);
}

function createAxios404Error() {
  return Object.assign(new Error('Not Found'), {
    isAxiosError: true,
    response: { status: 404 },
  });
}

describe('UserDetailPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createPlatformAdminApi as jest.Mock).mockReturnValue({
      listUsers: jest.fn(),
      getUserById: mockGetUserById,
    });
    (useParams as jest.Mock).mockReturnValue({ userId: 'u-2' });
    mockGetUserById.mockResolvedValue({ data: userWithPhone });
  });

  it('loads user detail and renders identity fields', async () => {
    render(<UserDetailPageClient />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetUserById).toHaveBeenCalledWith({ userId: 'u-2' });
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Grace Hopper' }),
      ).toBeInTheDocument();
    });
    expectDefinitionValue('ID', 'u-2');
    expectDefinitionValue('Name', 'Grace Hopper');
    expectDefinitionValue('Email', 'grace@example.com');
    expectDefinitionValue('First name', 'Grace');
    expectDefinitionValue('Last name', 'Hopper');
    expectDefinitionValue('Phone', '+1-555-0100');
    expectDefinitionValue('Role', 'User');
    expectDefinitionValue('Disabled', 'Yes');
    expectDefinitionValue('Email verified', 'No');
    expect(screen.getByRole('link', { name: 'Back to users' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });

  it('hides the phone field when phone is absent', async () => {
    (useParams as jest.Mock).mockReturnValue({ userId: 'u-1' });
    mockGetUserById.mockResolvedValue({ data: userWithoutPhone });

    render(<UserDetailPageClient />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Ada Lovelace' }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
  });

  it('shows User not found when the API returns 404', async () => {
    mockGetUserById.mockRejectedValue(createAxios404Error());

    render(<UserDetailPageClient />);

    await waitFor(() => {
      expect(screen.getByText('User not found.')).toBeInTheDocument();
    });
  });

  it('shows a generic error when getUserById rejects with a non-404 error', async () => {
    mockGetUserById.mockRejectedValue(new Error('Network error'));

    render(<UserDetailPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load user. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('shows User not found when userId is missing and does not call the API', async () => {
    (useParams as jest.Mock).mockReturnValue({});

    render(<UserDetailPageClient />);

    await waitFor(() => {
      expect(screen.getByText('User not found.')).toBeInTheDocument();
    });

    expect(mockGetUserById).not.toHaveBeenCalled();
  });

  it('does not surface vault, YouTube, or secret operational fields', async () => {
    const secretFieldValues = [
      'SECRET_VAULT_BLOB',
      'ya29.secret-token',
      'should-never-appear',
      'mk-secret',
    ] as const;

    const bloatedUser = {
      ...userWithPhone,
      vaultCiphertext: 'SECRET_VAULT_BLOB',
      youtubeOAuthToken: 'ya29.secret-token',
      password: 'should-never-appear',
      masterKey: 'mk-secret',
    } as AdminUserIdentity;

    mockGetUserById.mockResolvedValue({ data: bloatedUser });

    const { container } = render(<UserDetailPageClient />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Grace Hopper' }),
      ).toBeInTheDocument();
    });

    expectDefinitionValue('Email', 'grace@example.com');
    expectDefinitionValue('Role', 'User');
    expectDefinitionValue('Phone', '+1-555-0100');

    for (const secretValue of secretFieldValues) {
      expect(container.textContent).not.toContain(secretValue);
    }

    expectNoSensitiveContent(container);
  });
});
