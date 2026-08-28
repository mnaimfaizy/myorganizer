/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { VaultSyncStatus } from '@myorganizer/web-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';

const mockUseVaultSyncStatus = jest.fn();

jest.mock('./useVaultSyncStatus', () => ({
  useVaultSyncStatus: () => mockUseVaultSyncStatus(),
}));

import { SyncStatusWidget } from './syncStatusWidget';

describe('SyncStatusWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders SyncStatusIndicator with synced status from hook', () => {
    const status: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    // Synced status should render no visible label
    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
  });

  test('renders SyncStatusIndicator with pending status from hook', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    const label = screen.getByTestId('sync-status-label');
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe('Changes not yet sent');
  });

  test('passes retry function from hook to SyncStatusIndicator', () => {
    const mockRetry = jest.fn();
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: mockRetry,
    });

    render(<SyncStatusWidget />);

    const retryButton = screen.getByTestId('sync-status-retry-button');
    retryButton.click();

    expect(mockRetry).toHaveBeenCalled();
  });

  test('passes className prop through to SyncStatusIndicator', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget className="custom-widget-class" />);

    const indicator = screen.getByTestId('sync-status-indicator');
    expect(indicator).toHaveClass('custom-widget-class');
  });

  test('renders terminal status from hook', () => {
    const status: VaultSyncStatus = {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [{ type: VaultBlobType.Groceries, status: 422 }],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    const label = screen.getByTestId('sync-status-label');
    const detail = screen.getByTestId('sync-status-detail');

    expect(label.textContent).toBe('Some changes could not be saved');
    expect(detail.textContent).toContain('Grocery Lists');
  });

  test('renders session-ended status from hook', () => {
    const status: VaultSyncStatus = {
      kind: 'session-ended',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    mockUseVaultSyncStatus.mockReturnValue({
      status,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    const label = screen.getByTestId('sync-status-label');
    expect(label.textContent).toBe('Sync stopped — sign in again');
  });

  test('renders null status from hook (loading state)', () => {
    mockUseVaultSyncStatus.mockReturnValue({
      status: null,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
  });
});
