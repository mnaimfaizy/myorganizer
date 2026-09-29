/* eslint-disable import/first -- jest.mock must precede application imports */
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import { useOptionalVaultSession } from './session';
import {
  DASHBOARD_MOUNT_SETTLED_TEST_ID,
  useReportVaultMountSettle,
  VaultMountSettleProvider,
} from './vaultMountSettle';

type FirstSettledControl = {
  resolve: () => void;
  promise: Promise<void>;
};

function createFirstSettledControl(): FirstSettledControl {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}

function arrangeSession(
  owner: string | null,
  firstSettled: Promise<void> | null,
) {
  (useOptionalVaultSession as jest.Mock).mockReturnValue(
    owner === null
      ? null
      : {
          handle: { owner },
          pullTrigger: firstSettled ? { firstSettled } : null,
        },
  );
}

function marker() {
  return screen.getByTestId(DASHBOARD_MOUNT_SETTLED_TEST_ID);
}

/**
 * Stands in for `VaultMetaConvergeRunner` / `VaultReconcileRunner`: reports
 * once on mount, from an effect — the same as the real runners' async
 * `.finally()`, never from render (calling the reporter during render, like
 * a component update, is not how production code does it).
 */
function ReportingLeg({ leg }: { leg: 'meta-converge' | 'reconcile' }) {
  const report = useReportVaultMountSettle(leg);
  useEffect(() => {
    report();
  }, [report]);
  return null;
}

describe('VaultMountSettleProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('marker starts settled=true when there is no owner — nothing to wait on', async () => {
    arrangeSession(null, null);

    render(
      <VaultMountSettleProvider>
        <div />
      </VaultMountSettleProvider>,
    );

    expect(marker()).toHaveAttribute('data-settled', 'true');
  });

  test('marker starts settled=false with an owner, until all three legs report', async () => {
    const pull = createFirstSettledControl();
    arrangeSession('user-a', pull.promise);

    render(
      <VaultMountSettleProvider>
        <ReportingLeg leg="meta-converge" />
      </VaultMountSettleProvider>,
    );

    expect(marker()).toHaveAttribute('data-settled', 'false');
  });

  test('flips to settled=true only once meta-converge, reconcile, and pull have all settled', async () => {
    const pull = createFirstSettledControl();
    arrangeSession('user-a', pull.promise);

    render(
      <VaultMountSettleProvider>
        <ReportingLeg leg="meta-converge" />
      </VaultMountSettleProvider>,
    );

    expect(marker()).toHaveAttribute('data-settled', 'false');

    // Pull settles, but reconcile has not reported yet.
    pull.resolve();
    await waitFor(() => {
      // Still false — reconcile is the missing leg.
      expect(marker()).toHaveAttribute('data-settled', 'false');
    });
  });

  test('flips to settled=true once every leg has reported, in any order', async () => {
    const pull = createFirstSettledControl();
    arrangeSession('user-a', pull.promise);

    render(
      <VaultMountSettleProvider>
        <ReportingLeg leg="meta-converge" />
        <ReportingLeg leg="reconcile" />
      </VaultMountSettleProvider>,
    );

    // Meta-converge and reconcile both reported on mount; only pull remains.
    expect(marker()).toHaveAttribute('data-settled', 'false');

    pull.resolve();

    await waitFor(() => {
      expect(marker()).toHaveAttribute('data-settled', 'true');
    });
  });

  test('a new owner resets the signal back to unsettled', async () => {
    const firstPull = createFirstSettledControl();
    arrangeSession('user-a', firstPull.promise);

    const { rerender } = render(
      <VaultMountSettleProvider>
        <ReportingLeg leg="meta-converge" />
        <ReportingLeg leg="reconcile" />
      </VaultMountSettleProvider>,
    );

    firstPull.resolve();
    await waitFor(() => {
      expect(marker()).toHaveAttribute('data-settled', 'true');
    });

    // A different owner mounts — e.g. a second sign-in in the same tree.
    // Nothing has reported for them yet.
    const secondPull = createFirstSettledControl();
    arrangeSession('user-b', secondPull.promise);

    rerender(
      <VaultMountSettleProvider>
        <div />
      </VaultMountSettleProvider>,
    );

    expect(marker()).toHaveAttribute('data-settled', 'false');
  });

  test('useReportVaultMountSettle is a no-op outside a provider', () => {
    // VaultMetaConvergeRunner and VaultReconcileRunner's own unit tests
    // render standalone, with nothing wrapping them.
    function Standalone() {
      const report = useReportVaultMountSettle('meta-converge');
      report();
      return null;
    }

    expect(() => render(<Standalone />)).not.toThrow();
  });
});
