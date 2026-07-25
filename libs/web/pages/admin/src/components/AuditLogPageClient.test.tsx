/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('../lib/apiClient', () => ({
  createPlatformAdminApi: jest.fn(),
}));

import type { AdminAuditLogEntry } from '@myorganizer/app-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { createPlatformAdminApi } from '../lib/apiClient';
import { formatAuditTimestamp } from '../lib/formatAuditLog';

import { AuditLogPageClient } from './AuditLogPageClient';

const mockListAuditLogs = jest.fn();

const sampleEntries: AdminAuditLogEntry[] = [
  {
    id: 'audit-1',
    action: 'disable',
    actorUserId: 'actor-1',
    targetUserId: 'target-1',
    createdAt: '2026-07-16T12:00:00.000Z',
  },
  {
    id: 'audit-2',
    action: 'force_logout',
    actorUserId: 'actor-2',
    targetUserId: 'target-2',
    createdAt: '2026-07-15T08:30:00.000Z',
  },
  {
    id: 'audit-3',
    action: 'resend_verification',
    actorUserId: 'actor-3',
    targetUserId: 'target-3',
    createdAt: '2026-07-14T16:45:00.000Z',
  },
];

describe('AuditLogPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createPlatformAdminApi as jest.Mock).mockReturnValue({
      listAuditLogs: mockListAuditLogs,
    });
    mockListAuditLogs.mockResolvedValue({ data: sampleEntries });
  });

  it('shows loading state on mount and calls listAuditLogs with limit 50', async () => {
    let resolveLoad!: (value: { data: AdminAuditLogEntry[] }) => void;
    const pendingLoad = new Promise<{ data: AdminAuditLogEntry[] }>(
      (resolve) => {
        resolveLoad = resolve;
      },
    );
    mockListAuditLogs.mockReturnValue(pendingLoad);

    render(<AuditLogPageClient />);

    expect(
      screen.getByRole('heading', { name: 'Admin Audit Log' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    resolveLoad({ data: sampleEntries });

    await waitFor(() => {
      expect(mockListAuditLogs).toHaveBeenCalledWith({ limit: 50 });
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
  });

  it('renders table headers and rows with actor, target, and action labels', async () => {
    render(<AuditLogPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Disable')).toBeInTheDocument();
    });

    expect(mockListAuditLogs).toHaveBeenCalledWith({ limit: 50 });
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Actor')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();

    expect(screen.getByText('actor-1')).toBeInTheDocument();
    expect(screen.getByText('target-1')).toBeInTheDocument();
    expect(screen.getByText('Force logout')).toBeInTheDocument();
    expect(screen.getByText('actor-2')).toBeInTheDocument();
    expect(screen.getByText('target-2')).toBeInTheDocument();
    expect(screen.getByText('Resend verification')).toBeInTheDocument();
    expect(screen.getByText('actor-3')).toBeInTheDocument();
    expect(screen.getByText('target-3')).toBeInTheDocument();
  });

  it('formats timestamps with the same Intl options as formatAuditTimestamp', async () => {
    const timestamp = '2026-07-16T12:00:00.000Z';
    mockListAuditLogs.mockResolvedValue({
      data: [
        {
          id: 'audit-ts',
          action: 'enable',
          actorUserId: 'actor-ts',
          targetUserId: 'target-ts',
          createdAt: timestamp,
        },
      ],
    });

    render(<AuditLogPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText(formatAuditTimestamp(timestamp)),
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when the API returns no entries', async () => {
    mockListAuditLogs.mockResolvedValue({ data: [] });

    render(<AuditLogPageClient />);

    await waitFor(() => {
      expect(screen.getByText('No audit log entries yet.')).toBeInTheDocument();
    });

    expect(mockListAuditLogs).toHaveBeenCalledWith({ limit: 50 });
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
  });

  it('shows an error message when listAuditLogs rejects', async () => {
    mockListAuditLogs.mockRejectedValue(new Error('Network error'));

    render(<AuditLogPageClient />);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load audit log. Please try again.'),
      ).toBeInTheDocument();
    });

    expect(mockListAuditLogs).toHaveBeenCalledWith({ limit: 50 });
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
    expect(screen.queryByText('Disable')).not.toBeInTheDocument();
  });

  it('does not surface vault or secret operational fields from bloated entries', async () => {
    const secretFieldValues = [
      'SECRET_VAULT_BLOB',
      'ya29.secret-token',
      'should-never-appear',
      'mk-secret',
    ] as const;

    const bloatedEntry = {
      ...sampleEntries[0],
      vaultCiphertext: 'SECRET_VAULT_BLOB',
      youtubeOAuthToken: 'ya29.secret-token',
      password: 'should-never-appear',
      masterKey: 'mk-secret',
    } as AdminAuditLogEntry;

    mockListAuditLogs.mockResolvedValue({ data: [bloatedEntry] });

    const { container } = render(<AuditLogPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Disable')).toBeInTheDocument();
    });

    expect(screen.getByText('actor-1')).toBeInTheDocument();
    expect(screen.getByText('target-1')).toBeInTheDocument();

    for (const secretValue of secretFieldValues) {
      expect(container.textContent).not.toContain(secretValue);
    }
  });
});
