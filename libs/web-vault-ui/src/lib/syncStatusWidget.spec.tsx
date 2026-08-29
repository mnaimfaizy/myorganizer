/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  test('synced status renders no chip and no label', () => {
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

    // No trigger chip
    expect(screen.queryByTestId('sync-status-trigger')).not.toBeInTheDocument();
    // No visible label
    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
    // Indicator still renders for sr-only content
    expect(screen.getByTestId('sync-status-indicator')).toBeInTheDocument();
  });

  test('null status renders no chip and no label', () => {
    mockUseVaultSyncStatus.mockReturnValue({
      status: null,
      retry: jest.fn(),
    });

    render(<SyncStatusWidget />);

    expect(screen.queryByTestId('sync-status-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
  });

  test('pending status renders chip and label text', async () => {
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

    // Chip exists with label text
    const trigger = screen.getByTestId('sync-status-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Changes not yet sent');

    // Detail and retry button are NOT in the document yet
    expect(screen.queryByTestId('sync-status-detail')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sync-status-retry-button'),
    ).not.toBeInTheDocument();
  });

  test('clicking pending chip opens popover and shows detail and retry button', async () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    fireEvent.click(trigger);

    // After clicking, detail and retry button appear
    await waitFor(() => {
      expect(screen.getByTestId('sync-status-detail')).toBeInTheDocument();
      expect(
        screen.getByTestId('sync-status-retry-button'),
      ).toBeInTheDocument();
    });
  });

  test('retry button in popover calls retry hook', async () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByTestId('sync-status-retry-button'),
      ).toBeInTheDocument();
    });

    const retryButton = screen.getByTestId('sync-status-retry-button');
    fireEvent.click(retryButton);

    expect(mockRetry).toHaveBeenCalled();
  });

  test('terminal status renders chip with label text', async () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Some changes could not be saved');
  });

  test('clicking terminal chip opens popover and shows detail', async () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      const detail = screen.getByTestId('sync-status-detail');
      expect(detail).toBeInTheDocument();
      expect(detail).toHaveTextContent('Grocery Lists');
    });
  });

  test('session-ended status renders chip with label text', async () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Sync stopped — sign in again');
  });

  test('chip has sr-only accessible name', () => {
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

    const trigger = screen.getByTestId('sync-status-trigger');
    // The button should have an sr-only accessible name combining label and action
    expect(trigger).toHaveAccessibleName(
      'Changes not yet sent. Show sync details.',
    );
  });

  test('className prop is applied to the chip for labelled status', () => {
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

    render(<SyncStatusWidget className="custom-class" />);

    const trigger = screen.getByTestId('sync-status-trigger');
    expect(trigger).toHaveClass('custom-class');
  });

  test('className prop is applied to indicator for synced status', () => {
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

    render(<SyncStatusWidget className="custom-class" />);

    const indicator = screen.getByTestId('sync-status-indicator');
    expect(indicator).toHaveClass('custom-class');
  });
});
