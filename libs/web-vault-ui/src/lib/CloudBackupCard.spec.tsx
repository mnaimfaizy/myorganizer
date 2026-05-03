import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';

import { CloudBackupCard, CloudBackupCardConnection } from './CloudBackupCard';

const noop = () => undefined;

function renderCard(
  overrides: Partial<React.ComponentProps<typeof CloudBackupCard>> = {},
) {
  const defaults: React.ComponentProps<typeof CloudBackupCard> = {
    connection: { status: 'disconnected' },
    autoInterval: 'off',
    latestRecord: null,
    onConnect: noop,
    onDisconnect: noop,
    onBackupNow: noop,
    onRestoreLatest: noop,
    onAutoIntervalChange: noop,
  };
  return render(<CloudBackupCard {...defaults} {...overrides} />);
}

function isDisabled(el: HTMLElement): boolean {
  return (
    el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
  );
}

describe('CloudBackupCard', () => {
  test('shows Connect button when disconnected', () => {
    renderCard({ connection: { status: 'disconnected' } });
    expect(
      screen.queryByTestId('cloud-backup-connection-disconnected'),
    ).not.toBeNull();
    expect(isDisabled(screen.getByTestId('cloud-backup-connect-button'))).toBe(
      false,
    );
  });

  test('shows Disconnect button when connected; backup actions enabled', () => {
    renderCard({ connection: { status: 'connected' } });
    expect(
      screen.queryByTestId('cloud-backup-connection-connected'),
    ).not.toBeNull();
    expect(
      isDisabled(screen.getByTestId('cloud-backup-disconnect-button')),
    ).toBe(false);
    expect(isDisabled(screen.getByTestId('cloud-backup-now-button'))).toBe(
      false,
    );
    expect(isDisabled(screen.getByTestId('cloud-backup-restore-button'))).toBe(
      false,
    );
  });

  test('renders reconnect message; backup/restore disabled', () => {
    const conn: CloudBackupCardConnection = {
      status: 'needs-reconnect',
      reason: 'token expired',
    };
    renderCard({ connection: conn });
    const text =
      screen.getByTestId('cloud-backup-connection-needs-reconnect')
        .textContent ?? '';
    expect(text).toMatch(/Reconnect required.*token expired/);
    expect(isDisabled(screen.getByTestId('cloud-backup-now-button'))).toBe(
      true,
    );
    expect(isDisabled(screen.getByTestId('cloud-backup-restore-button'))).toBe(
      true,
    );
  });

  test('disables actions while busy', () => {
    renderCard({ connection: { status: 'connected' }, isBusy: true });
    expect(isDisabled(screen.getByTestId('cloud-backup-now-button'))).toBe(
      true,
    );
    expect(isDisabled(screen.getByTestId('cloud-backup-restore-button'))).toBe(
      true,
    );
    expect(
      isDisabled(screen.getByTestId('cloud-backup-disconnect-button')),
    ).toBe(true);
  });

  test('renders loading state for latest record', () => {
    renderCard({ isLatestLoading: true });
    expect(screen.queryByTestId('cloud-backup-latest-loading')).not.toBeNull();
  });

  test('renders empty state for null latest record', () => {
    renderCard({ latestRecord: null });
    expect(screen.queryByTestId('cloud-backup-latest-empty')).not.toBeNull();
  });

  test('renders recorded state for loaded latest record', () => {
    renderCard({
      latestRecord: {
        source: 'google-drive',
        status: 'success',
        createdAt: '2026-04-15T00:00:00Z',
      },
    });
    expect(screen.queryByTestId('cloud-backup-latest-recorded')).not.toBeNull();
  });

  test('shows lastError when provided', () => {
    renderCard({ lastError: 'upload failed' });
    expect(screen.getByTestId('cloud-backup-error').textContent).toBe(
      'upload failed',
    );
  });

  test('Connect button click invokes onConnect', () => {
    const onConnect = jest.fn();
    renderCard({ onConnect });
    fireEvent.click(screen.getByTestId('cloud-backup-connect-button'));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
