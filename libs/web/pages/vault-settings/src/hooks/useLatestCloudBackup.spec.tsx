import { render, screen } from '@testing-library/react';
import { act } from 'react';

import { useLatestCloudBackup } from './useLatestCloudBackup';

function HookProbe({
  apiFactory,
}: {
  apiFactory: Parameters<typeof useLatestCloudBackup>[1];
}) {
  const state = useLatestCloudBackup(0, apiFactory);
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="record-id">
        {state.status === 'loaded' ? state.record.id : ''}
      </span>
    </div>
  );
}

function makeApiFactory(
  impl: (req: { status?: string; source?: string }) => Promise<unknown>,
): Parameters<typeof useLatestCloudBackup>[1] {
  return () =>
    ({
      getLatestBackup: impl as (req: {
        status?: string;
        source?: string;
      }) => Promise<{ data: never }>,
    }) as never;
}

describe('useLatestCloudBackup', () => {
  test('queries with status=success and source=google-drive on mount', async () => {
    const calls: { status?: string; source?: string }[] = [];
    const factory = makeApiFactory(async (req) => {
      calls.push(req);
      return {
        data: {
          id: 'cloud-1',
          event: 'export',
          source: 'google-drive',
          status: 'success',
          createdAt: '2026-04-15T00:00:00Z',
          schemaVersion: 1,
          sizeBytes: 4242,
        },
      };
    });

    await act(async () => {
      render(<HookProbe apiFactory={factory} />);
    });

    expect(calls).toEqual([{ status: 'success', source: 'google-drive' }]);
    expect(screen.getByTestId('status').textContent).toBe('loaded');
    expect(screen.getByTestId('record-id').textContent).toBe('cloud-1');
  });

  test('resolves to empty on 404', async () => {
    const factory = makeApiFactory(async () => {
      const err: { response: { status: number } } = {
        response: { status: 404 },
      };
      throw err;
    });

    await act(async () => {
      render(<HookProbe apiFactory={factory} />);
    });

    expect(screen.getByTestId('status').textContent).toBe('empty');
  });

  test('resolves to error on other failures', async () => {
    const factory = makeApiFactory(async () => {
      throw new Error('network');
    });

    await act(async () => {
      render(<HookProbe apiFactory={factory} />);
    });

    expect(screen.getByTestId('status').textContent).toBe('error');
  });
});
