import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import type { VaultSyncStatus } from '@myorganizer/web-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';

import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  test('synced status renders no visible label or detail', () => {
    const status: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sync-status-detail')).not.toBeInTheDocument();
  });

  test('synced status still renders status region for announcements', () => {
    const status: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  test('null status (loading) renders no visible label', () => {
    render(<SyncStatusIndicator status={null} />);

    expect(screen.queryByTestId('sync-status-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sync-status-detail')).not.toBeInTheDocument();
  });

  test('pending status renders visible label and detail', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const label = screen.getByTestId('sync-status-label');
    const detail = screen.getByTestId('sync-status-detail');

    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe('Changes not yet sent');
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toContain('Tasks');
  });

  test('session-ended status renders with distinct message from pending', () => {
    const status: VaultSyncStatus = {
      kind: 'session-ended',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const label = screen.getByTestId('sync-status-label');
    const detail = screen.getByTestId('sync-status-detail');

    expect(label.textContent).toBe('Sync stopped — sign in again');
    expect(detail.textContent).toContain('session ended');
    // Ensure it's different from pending's "Changes not yet sent"
    expect(label.textContent).not.toBe('Changes not yet sent');
  });

  test('terminal status with 422 renders visibly different from pending', () => {
    const status: VaultSyncStatus = {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [{ type: VaultBlobType.Groceries, status: 422 }],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const label = screen.getByTestId('sync-status-label');
    const detail = screen.getByTestId('sync-status-detail');

    expect(label.textContent).toBe('Some changes could not be saved');
    expect(detail.textContent).toContain('Grocery Lists');
    // Key assertion: terminal does NOT read as "not synced yet"
    expect(detail.textContent).not.toMatch(/not synced yet/i);
    expect(detail.textContent).not.toMatch(/not yet reached the server/i);
  });

  test('terminal status names all affected blob types in detail', () => {
    const status: VaultSyncStatus = {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [
        { type: VaultBlobType.Groceries, status: 422 },
        { type: VaultBlobType.Tasks, status: 422 },
      ],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const detail = screen.getByTestId('sync-status-detail');
    expect(detail.textContent).toContain('Grocery Lists');
    expect(detail.textContent).toContain('Tasks');
  });

  test('retry button renders when onRetry is provided and canRetry is true', () => {
    const onRetry = jest.fn();
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} onRetry={onRetry} />);

    const button = screen.getByTestId('sync-status-retry-button');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe('Retry now');
  });

  test('retry button calls onRetry once when clicked', () => {
    const onRetry = jest.fn();
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} onRetry={onRetry} />);

    const button = screen.getByTestId('sync-status-retry-button');
    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('retry button is absent when onRetry is not provided', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    expect(
      screen.queryByTestId('sync-status-retry-button'),
    ).not.toBeInTheDocument();
  });

  test('retry button is absent when onRetry is provided but canRetry is false (synced)', () => {
    const onRetry = jest.fn();
    const status: VaultSyncStatus = {
      kind: 'synced',
      pendingTypes: [],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} onRetry={onRetry} />);

    expect(
      screen.queryByTestId('sync-status-retry-button'),
    ).not.toBeInTheDocument();
  });

  test('className prop is merged onto root element', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} className="custom-class" />);

    const root = screen.getByTestId('sync-status-indicator');
    expect(root).toHaveClass('custom-class');
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('flex-col');
    expect(root).toHaveClass('gap-2');
  });

  test('pending status with retrying includes retry text', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: true,
    };

    render(<SyncStatusIndicator status={status} />);

    const detail = screen.getByTestId('sync-status-detail');
    expect(detail.textContent).toContain('Retrying automatically');
  });

  test('status region announces label and detail for screen readers', () => {
    const status: VaultSyncStatus = {
      kind: 'pending',
      pendingTypes: [VaultBlobType.Tasks],
      terminalFailures: [],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion.textContent).toContain('Changes not yet sent');
    expect(statusRegion.textContent).toContain('Tasks');
  });

  test('terminal status renders error icon', () => {
    const status: VaultSyncStatus = {
      kind: 'terminal',
      pendingTypes: [],
      terminalFailures: [{ type: VaultBlobType.Groceries, status: 422 }],
      retrying: false,
    };

    render(<SyncStatusIndicator status={status} />);

    // CircleAlert icon should be present
    const iconElement = screen.getByTestId('sync-status-label').parentElement;
    expect(iconElement).toBeInTheDocument();
    // The icon has aria-hidden
    expect(
      iconElement?.querySelector('[aria-hidden="true"]'),
    ).toBeInTheDocument();
  });
});
