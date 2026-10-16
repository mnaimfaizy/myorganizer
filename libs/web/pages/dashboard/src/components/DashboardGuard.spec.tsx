/* eslint-disable import/first */
const mockReplace = jest.fn();
// Stable router reference, matching next/navigation. A fresh object per call
// would re-run the guard's effects on every render.
const mockRouter = { replace: mockReplace };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@myorganiser/auth', () => ({
  authSession: {},
  resolveOutboundGuard: jest.fn(),
  onSessionEnded: jest.fn(),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  SessionEndedEvent,
  SessionEndedListener,
} from '@myorganiser/auth';
import DashboardGuard from './DashboardGuard';
import { onSessionEnded, resolveOutboundGuard } from '@myorganiser/auth';

describe('DashboardGuard', () => {
  const mockResolveOutboundGuard = resolveOutboundGuard as jest.Mock;
  const mockOnSessionEnded = onSessionEnded as jest.Mock;
  const mockUnsubscribe = jest.fn();

  // Answers each successive guard call with the next outcome; the last one repeats.
  function mockOutcomes(...outcomes: Array<{ kind: string }>) {
    let call = 0;
    mockResolveOutboundGuard.mockImplementation(() =>
      Promise.resolve(outcomes[Math.min(call++, outcomes.length - 1)]),
    );
  }

  function fireReconnectTrigger(
    trigger: 'online' | 'focus' | 'visibilitychange',
  ) {
    act(() => {
      if (trigger === 'visibilitychange') {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      } else {
        window.dispatchEvent(new Event(trigger));
      }
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOutboundGuard.mockReset();
    mockReplace.mockClear();
    mockOnSessionEnded.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('should render children when authenticated', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await screen.findByText('dashboard-content');
    expect(screen.getByText('dashboard-content')).toBeInTheDocument();
  });

  it('should redirect to /login when guest', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'redirect_login' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
  });

  it('does not subscribe to session end while the initial decision is pending', () => {
    mockResolveOutboundGuard.mockImplementation(() => new Promise(() => {}));

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it('does not subscribe to session end when the initial outcome is a login redirect', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'redirect_login' });

    render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
    expect(mockOnSessionEnded).not.toHaveBeenCalled();
  });

  it.each<SessionEndedEvent['reason']>([
    'refresh_rejected',
    'signed_out_elsewhere',
  ])(
    'removes children and redirects to /login when the session ends (%s)',
    async (reason) => {
      mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      await screen.findByText('dashboard-content');
      expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);

      const listener = mockOnSessionEnded.mock
        .calls[0][0] as SessionEndedListener;

      act(() => {
        listener({ reason });
      });

      expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    },
  );

  it('calls the unsubscribe function returned by onSessionEnded on unmount', async () => {
    mockResolveOutboundGuard.mockResolvedValue({ kind: 'allow' });

    const { unmount } = render(
      <DashboardGuard>
        <div>dashboard-content</div>
      </DashboardGuard>,
    );

    await screen.findByText('dashboard-content');
    expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  describe('when the server cannot restore a Restorable Session', () => {
    it('shows the unreachable notice without children and does not redirect to login', async () => {
      mockOutcomes({ kind: 'restore_unavailable' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Can't reach the server",
      );
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
      expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('renders children when Try again resolves to allow', async () => {
      mockOutcomes({ kind: 'restore_unavailable' }, { kind: 'allow' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('dashboard-content')).toBeInTheDocument();
      expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it.each<'online' | 'focus' | 'visibilitychange'>([
      'online',
      'focus',
      'visibilitychange',
    ])(
      'retries on %s and redirects to /login when the retry resolves to redirect_login',
      async (trigger) => {
        mockOutcomes(
          { kind: 'restore_unavailable' },
          { kind: 'redirect_login' },
        );

        render(
          <DashboardGuard>
            <div>dashboard-content</div>
          </DashboardGuard>,
        );

        await screen.findByRole('alert');
        fireReconnectTrigger(trigger);

        await waitFor(() => {
          expect(mockReplace).toHaveBeenCalledWith('/login');
        });
        expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);
        expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      },
    );

    it('keeps the notice and re-enables Try again when the retry is still unavailable', async () => {
      mockOutcomes(
        { kind: 'restore_unavailable' },
        { kind: 'restore_unavailable' },
      );

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      await waitFor(() => {
        expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);
      });
      const button = screen.getByRole('button', { name: 'Try again' });
      await waitFor(() => {
        expect(button).toBeEnabled();
      });
      expect(button).toHaveAttribute('aria-busy', 'false');
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('ignores a second retry while one is in flight', async () => {
      let resolveRetry!: (outcome: { kind: string }) => void;
      mockResolveOutboundGuard
        .mockImplementationOnce(() =>
          Promise.resolve({ kind: 'restore_unavailable' }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<{ kind: string }>((resolve) => {
              resolveRetry = resolve;
            }),
        );

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      const pendingButton = screen.getByRole('button', { name: 'Try again' });
      expect(pendingButton).toBeDisabled();
      expect(pendingButton).toHaveAttribute('aria-busy', 'true');

      fireReconnectTrigger('focus');
      fireEvent.click(pendingButton);

      expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);

      act(() => {
        resolveRetry({ kind: 'allow' });
      });

      expect(await screen.findByText('dashboard-content')).toBeInTheDocument();
      expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);
    });

    it('removes children and redirects to /login when the session ends while unavailable', async () => {
      mockOutcomes({ kind: 'restore_unavailable' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      await screen.findByRole('alert');
      expect(mockOnSessionEnded).toHaveBeenCalledTimes(1);

      const listener = mockOnSessionEnded.mock
        .calls[0][0] as SessionEndedListener;

      act(() => {
        listener({ reason: 'refresh_rejected' });
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument();
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('stops retrying on reconnect once the shell is ready', async () => {
      mockOutcomes({ kind: 'restore_unavailable' }, { kind: 'allow' });

      render(
        <DashboardGuard>
          <div>dashboard-content</div>
        </DashboardGuard>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
      await screen.findByText('dashboard-content');
      expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);

      fireReconnectTrigger('online');
      fireReconnectTrigger('focus');

      expect(mockResolveOutboundGuard).toHaveBeenCalledTimes(2);
      expect(screen.getByText('dashboard-content')).toBeInTheDocument();
    });
  });
});
