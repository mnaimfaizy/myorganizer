/* eslint-disable import/first */
import '@testing-library/jest-dom';

jest.mock('@myorganizer/web-ui', () => ({
  cn: (...classes: Array<string | undefined | false>) =>
    classes.filter(Boolean).join(' '),
}));

import { render, screen } from '@testing-library/react';
import type { YouTubeSyncStatus } from '../types';
import { SYNC_DELAYED_AFTER_MS } from '../lib/syncFreshness';
import { SyncFreshnessIndicator } from './SyncFreshnessIndicator';

// The polite live region repeats the label and detail verbatim, so visible-text
// queries skip it and the announcement is asserted through role="status".
const VISIBLE = { ignore: '.sr-only' } as const;

function statusOf(
  overrides: Partial<YouTubeSyncStatus> = {},
): YouTubeSyncStatus {
  return {
    status: 'success',
    lastSyncedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lastSyncAttemptAt: null,
    lastSyncError: null,
    retryAt: null,
    ...overrides,
  };
}

describe('SyncFreshnessIndicator', () => {
  it('shows when the library was last synced', () => {
    render(<SyncFreshnessIndicator status={statusOf()} />);
    expect(screen.getByText(/^Last synced /, VISIBLE)).toBeInTheDocument();
  });

  it('shows "Never synced" before the first sync', () => {
    render(
      <SyncFreshnessIndicator
        status={statusOf({ status: 'never', lastSyncedAt: null })}
      />,
    );
    expect(screen.getByText('Never synced', VISIBLE)).toBeInTheDocument();
  });

  it('adds no state label while the library is current', () => {
    render(<SyncFreshnessIndicator status={statusOf()} />);
    expect(
      screen.queryByText(/failed|delayed|quota/i, VISIBLE),
    ).not.toBeInTheDocument();
  });

  it('names a failed sync in text, not by color alone', () => {
    render(<SyncFreshnessIndicator status={statusOf({ status: 'failed' })} />);
    expect(screen.getByText('Last sync failed', VISIBLE)).toBeInTheDocument();
    expect(
      screen.getByText(/last good snapshot/i, VISIBLE),
    ).toBeInTheDocument();
  });

  it('names a partial sync', () => {
    render(<SyncFreshnessIndicator status={statusOf({ status: 'partial' })} />);
    expect(
      screen.getByText('Some channels did not sync', VISIBLE),
    ).toBeInTheDocument();
  });

  it('explains a quota stall and that cached uploads still work', () => {
    render(
      <SyncFreshnessIndicator
        status={statusOf({ status: 'quota_exceeded' })}
      />,
    );
    expect(screen.getByText(/quota reached/i, VISIBLE)).toBeInTheDocument();
    expect(
      screen.getByText(/cached uploads stay available/i, VISIBLE),
    ).toBeInTheDocument();
  });

  it('flags a sync that has not completed in over a day', () => {
    render(
      <SyncFreshnessIndicator
        status={statusOf({
          lastSyncedAt: new Date(
            Date.now() - SYNC_DELAYED_AFTER_MS - 1000,
          ).toISOString(),
        })}
      />,
    );
    expect(screen.getByText('Sync delayed', VISIBLE)).toBeInTheDocument();
  });

  it('reports a pending reading while the status is still loading', () => {
    render(<SyncFreshnessIndicator status={null} />);
    expect(
      screen.getByText('Checking sync status…', VISIBLE),
    ).toBeInTheDocument();
  });

  describe('assistive tech', () => {
    it('announces a failure politely', () => {
      render(
        <SyncFreshnessIndicator status={statusOf({ status: 'failed' })} />,
      );
      const region = screen.getByRole('status');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveTextContent('Last sync failed');
    });

    it('stays silent while the library is healthy', () => {
      render(<SyncFreshnessIndicator status={statusOf()} />);
      expect(screen.getByRole('status')).toHaveTextContent('');
    });
  });
});
