/* eslint-disable import/first */
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@myorganiser/auth', () => ({
  authSession: {},
  resolveInboundGuard: jest.fn(),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import RootAuthRedirect from './RootAuthRedirect';
import { resolveInboundGuard } from '@myorganiser/auth';

describe('RootAuthRedirect', () => {
  const mockResolveInboundGuard = resolveInboundGuard as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveInboundGuard.mockReset();
    mockReplace.mockClear();
  });

  it('should redirect to /dashboard when authenticated', async () => {
    mockResolveInboundGuard.mockResolvedValue({ kind: 'redirect_dashboard' });

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(screen.queryByText('landing')).not.toBeInTheDocument();
  });

  it('should show landing when guest', async () => {
    mockResolveInboundGuard.mockResolvedValue({ kind: 'show_guest' });

    render(
      <RootAuthRedirect>
        <div>landing</div>
      </RootAuthRedirect>,
    );

    await screen.findByText('landing');
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  describe('when the restore is unavailable', () => {
    function setVisibilityState(state: 'visible' | 'hidden') {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      });
    }

    function resolveInboundOutcomes(outcomes: unknown[]) {
      mockResolveInboundGuard.mockImplementation(() => {
        const index = mockResolveInboundGuard.mock.calls.length - 1;
        return Promise.resolve(outcomes[Math.min(index, outcomes.length - 1)]);
      });
    }

    beforeEach(() => {
      setVisibilityState('visible');
    });

    afterEach(() => {
      setVisibilityState('visible');
    });

    it('should show the landing page without redirecting', async () => {
      mockResolveInboundGuard.mockResolvedValue({
        kind: 'restore_unavailable',
      });

      render(
        <RootAuthRedirect>
          <div>landing</div>
        </RootAuthRedirect>,
      );

      await screen.findByText('landing');
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockResolveInboundGuard).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['online', () => fireEvent(window, new Event('online'))],
      ['focus', () => fireEvent.focus(window)],
      [
        'visibilitychange to visible',
        () => fireEvent(document, new Event('visibilitychange')),
      ],
    ])(
      'should retry on %s and redirect to /dashboard once the restore completes',
      async (_trigger, fire) => {
        resolveInboundOutcomes([
          { kind: 'restore_unavailable' },
          { kind: 'redirect_dashboard' },
        ]);

        render(
          <RootAuthRedirect>
            <div>landing</div>
          </RootAuthRedirect>,
        );
        await screen.findByText('landing');

        fire();

        await waitFor(() => {
          expect(mockReplace).toHaveBeenCalledWith('/dashboard');
        });
        expect(mockResolveInboundGuard).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('landing')).not.toBeInTheDocument();
      },
    );

    it('should keep the landing page and stop retrying when the retry resolves to a guest', async () => {
      resolveInboundOutcomes([
        { kind: 'restore_unavailable' },
        { kind: 'show_guest' },
      ]);

      render(
        <RootAuthRedirect>
          <div>landing</div>
        </RootAuthRedirect>,
      );
      await screen.findByText('landing');

      // Run the retry and let its commit settle inside act, so the retry
      // listeners are removed before the next events fire.
      await act(async () => {
        fireEvent.focus(window);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(mockResolveInboundGuard).toHaveBeenCalledTimes(2);

      fireEvent.focus(window);
      fireEvent(window, new Event('online'));
      await act(async () => {});

      expect(mockResolveInboundGuard).toHaveBeenCalledTimes(2);
      expect(screen.getByText('landing')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should ignore a retry while the previous retry is still in flight', async () => {
      let resolvePendingRetry: (value: unknown) => void = () => undefined;
      mockResolveInboundGuard.mockImplementation(() => {
        const callCount = mockResolveInboundGuard.mock.calls.length;
        if (callCount === 1) {
          return Promise.resolve({ kind: 'restore_unavailable' });
        }
        return new Promise((resolve) => {
          resolvePendingRetry = resolve;
        });
      });

      render(
        <RootAuthRedirect>
          <div>landing</div>
        </RootAuthRedirect>,
      );
      await screen.findByText('landing');

      fireEvent.focus(window);
      await waitFor(() => {
        expect(mockResolveInboundGuard).toHaveBeenCalledTimes(2);
      });

      fireEvent.focus(window);
      fireEvent(document, new Event('visibilitychange'));
      fireEvent(window, new Event('online'));
      await act(async () => {});

      expect(mockResolveInboundGuard).toHaveBeenCalledTimes(2);

      resolvePendingRetry({ kind: 'show_guest' });
      await act(async () => {});
      expect(screen.getByText('landing')).toBeInTheDocument();
    });
  });
});
