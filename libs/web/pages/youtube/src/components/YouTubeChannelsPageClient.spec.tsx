import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@myorganizer/web-ui', () => ({
  cn: (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' '),
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  Checkbox: ({ id, checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
  ConfirmDeleteDialog: ({
    open,
    title,
    description,
    children,
    onConfirm,
    confirmLabel,
  }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <div>{description}</div>
        {children}
        <button
          type="button"
          onClick={() => {
            void Promise.resolve(onConfirm()).catch(() => {
              // Real dialog keeps open on failure; avoid unhandled rejection in tests.
            });
          }}
        >
          {confirmLabel ?? 'Delete'}
        </button>
      </div>
    ) : null,
  Input: (props: any) => <input {...props} />,
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

const mockUseYouTubeAvailability = jest.fn();
const mockUseYouTubeStatus = jest.fn();
const mockUseYouTubeConnect = jest.fn();
const mockUseYouTubeSubscriptions = jest.fn();
const mockUseYouTubeSyncStatus = jest.fn();

jest.mock('../hooks', () => {
  class YouTubeRequestError extends Error {
    readonly status: number;
    readonly code?: string;

    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = 'YouTubeRequestError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    useYouTubeAvailability: () => mockUseYouTubeAvailability(),
    useYouTubeStatus: () => mockUseYouTubeStatus(),
    useYouTubeConnect: () => mockUseYouTubeConnect(),
    useYouTubeSubscriptions: () => mockUseYouTubeSubscriptions(),
    useYouTubeSyncStatus: () => mockUseYouTubeSyncStatus(),
    YouTubeRequestError,
    isRetryCooldownActive: (retryAt?: string | null) =>
      Boolean(retryAt && Date.parse(retryAt) > Date.now()),
    formatRetryAt: (retryAt?: string | null) =>
      retryAt ? new Date(retryAt).toLocaleString() : null,
  };
});

const { YouTubeChannelsPageClient } =
  require('./YouTubeChannelsPageClient') as typeof import('./YouTubeChannelsPageClient');

describe('YouTubeChannelsPageClient', () => {
  const defaultConnect = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  const defaultSubs = {
    subscriptions: [],
    loading: false,
    sync: jest.fn(),
    toggle: jest.fn(),
    refresh: jest.fn(),
  };

  const statusOf = (
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> => ({
    status: 'success' as const,
    lastSyncedAt: null,
    lastSyncAttemptAt: null,
    lastSyncError: null,
    retryAt: null,
    channelStatus: 'never' as const,
    channelLastAttemptAt: null,
    channelLastError: null,
    channelRetryAt: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseYouTubeAvailability.mockReturnValue({
      available: true,
      loading: false,
      error: null,
    });
    mockUseYouTubeConnect.mockReturnValue(defaultConnect);
    mockUseYouTubeSubscriptions.mockReturnValue(defaultSubs);
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerChannelSync: jest.fn().mockResolvedValue(undefined),
      isChannelCooldownActive: false,
      refresh: jest.fn(),
    });
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: jest.fn(),
    });
  });

  const renderConnected = (
    disconnect = jest.fn().mockResolvedValue({ revokeFailed: false }),
    syncStatusOverrides: Record<string, unknown> = {},
  ) => {
    const refreshStatus = jest.fn();
    mockUseYouTubeStatus.mockReturnValue({
      connected: true,
      status: 'connected',
      refresh: refreshStatus,
    });
    mockUseYouTubeConnect.mockReturnValue({
      connect: jest.fn(),
      disconnect,
    });
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: null,
      loading: false,
      triggerChannelSync: jest.fn().mockResolvedValue(undefined),
      isChannelCooldownActive: false,
      refresh: jest.fn(),
      ...syncStatusOverrides,
    });
    render(<YouTubeChannelsPageClient />);
    return { disconnect, refreshStatus };
  };

  const openDisconnectDialog = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Disconnect YouTube account' }),
    );
    return screen.getByRole('dialog', { name: 'Disconnect YouTube?' });
  };

  it('calls triggerChannelSync when Refresh channels is clicked', async () => {
    const triggerChannelSync = jest.fn().mockResolvedValue(undefined);
    mockUseYouTubeSyncStatus.mockReturnValue({
      status: statusOf({ status: 'never' }),
      loading: false,
      triggerChannelSync,
      isChannelCooldownActive: false,
      refresh: jest.fn(),
    });

    render(<YouTubeChannelsPageClient />);

    // The resolved request now ends the claim wait (#753), so let it settle.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh channels' }));
    });

    expect(triggerChannelSync).toHaveBeenCalledTimes(1);
  });

  describe('channel sync request completion (#753)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const setupChannelSyncTest = (triggerResult: boolean | Error) => {
      const refreshSync = jest
        .fn()
        .mockResolvedValue(statusOf({ status: 'never' }));

      const subs = {
        ...defaultSubs,
        refresh: jest.fn(),
      };
      mockUseYouTubeSubscriptions.mockReturnValue(subs);

      const triggerChannelSync =
        triggerResult instanceof Error
          ? jest.fn().mockRejectedValue(triggerResult)
          : jest.fn().mockResolvedValue(triggerResult);

      renderConnected(jest.fn().mockResolvedValue({ revokeFailed: false }), {
        status: statusOf({ status: 'never' }),
        loading: false,
        triggerChannelSync,
        isChannelCooldownActive: false,
        refresh: refreshSync,
      });

      return { subs };
    };

    it.each([
      {
        label: 'request that ran (success)',
        triggerResult: true,
        shouldRefresh: true,
      },
      {
        label: 'request that did not run (cooldown)',
        triggerResult: false,
        shouldRefresh: false,
      },
      {
        label: 'request rejects',
        triggerResult: new Error('request failed'),
        shouldRefresh: false,
      },
    ])(
      '$label → subs.refresh ${ #should call}',
      async ({ triggerResult, shouldRefresh }) => {
        const { subs } = setupChannelSyncTest(triggerResult);

        await act(async () => {
          fireEvent.click(
            screen.getByRole('button', { name: 'Refresh channels' }),
          );
        });

        await act(async () => {
          jest.advanceTimersByTime(0);
        });

        if (shouldRefresh) {
          expect(subs.refresh).toHaveBeenCalledTimes(1);
        } else {
          expect(subs.refresh).not.toHaveBeenCalled();
        }
      },
    );

    it('request that ran → claim-wait loop stops once', async () => {
      const refreshSync = jest
        .fn()
        .mockResolvedValue(statusOf({ status: 'never' }));
      const triggerChannelSync = jest.fn().mockResolvedValue(true);

      const subs = {
        ...defaultSubs,
        refresh: jest.fn(),
      };
      mockUseYouTubeSubscriptions.mockReturnValue(subs);

      renderConnected(jest.fn().mockResolvedValue({ revokeFailed: false }), {
        status: statusOf({ status: 'never' }),
        loading: false,
        triggerChannelSync,
        isChannelCooldownActive: false,
        refresh: refreshSync,
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Refresh channels' }),
        );
      });

      // Initial claim-wait poll from request resolution
      expect(refreshSync).toHaveBeenCalledTimes(1);

      // Advance several seconds — claim-wait loop should not call refreshSync again
      // because the request resolved with ran=true
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Still only the initial call (the request stopped the loop)
      expect(refreshSync).toHaveBeenCalledTimes(1);
    });

    it('dedupe: channelStatus discovering → terminal then request resolves → once', async () => {
      const refreshSync = jest
        .fn()
        .mockResolvedValue(statusOf({ status: 'never' }));

      let resolveRequest: ((val: any) => void) | null = null;
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      const triggerChannelSync = jest.fn().mockReturnValue(requestPromise);

      const subs = {
        ...defaultSubs,
        refresh: jest.fn(),
      };
      mockUseYouTubeSubscriptions.mockReturnValue(subs);

      mockUseYouTubeStatus.mockReturnValue({
        connected: true,
        status: 'connected',
        refresh: jest.fn(),
      });

      mockUseYouTubeSyncStatus.mockReturnValue({
        status: statusOf({ status: 'success', channelStatus: 'never' }),
        loading: false,
        triggerChannelSync,
        isChannelCooldownActive: false,
        refresh: refreshSync,
      });

      const { rerender } = render(<YouTubeChannelsPageClient />);

      // Click to start sync request
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Refresh channels' }),
        );
      });

      // Transition channelStatus to discovering
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: statusOf({
          status: 'success',
          channelStatus: 'discovering',
        }),
        loading: false,
        triggerChannelSync,
        isChannelCooldownActive: false,
        refresh: refreshSync,
      });

      act(() => {
        rerender(<YouTubeChannelsPageClient />);
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // Transition to terminal
      mockUseYouTubeSyncStatus.mockReturnValue({
        status: statusOf({
          status: 'success',
          channelStatus: 'success',
        }),
        loading: false,
        triggerChannelSync,
        isChannelCooldownActive: false,
        refresh: refreshSync,
      });

      act(() => {
        rerender(<YouTubeChannelsPageClient />);
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // Poll path should have fired once
      expect(subs.refresh).toHaveBeenCalledTimes(1);

      // Now resolve the request — should be deduplicated
      subs.refresh.mockClear();

      await act(async () => {
        resolveRequest?.(true);
        jest.advanceTimersByTime(0);
      });

      // No additional refresh from the request path
      expect(subs.refresh).not.toHaveBeenCalled();
    });
  });

  describe('disconnect confirm', () => {
    it('opens confirm dialog without calling disconnect until confirmed', () => {
      const { disconnect } = renderConnected();
      const dialog = openDisconnectDialog();

      expect(dialog).toBeInTheDocument();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it('calls disconnect with deleteWatchedMarks false when confirmed without checkbox', async () => {
      const disconnect = jest.fn().mockResolvedValue({ revokeFailed: false });
      renderConnected(disconnect);
      const dialog = openDisconnectDialog();

      await act(async () => {
        fireEvent.click(
          within(dialog).getByRole('button', { name: 'Disconnect' }),
        );
      });

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledWith({ deleteWatchedMarks: false });
    });

    it('calls disconnect with deleteWatchedMarks true when wipe checkbox is checked', async () => {
      const disconnect = jest.fn().mockResolvedValue({ revokeFailed: false });
      renderConnected(disconnect);
      const dialog = openDisconnectDialog();

      fireEvent.click(screen.getByLabelText('Also delete my Watched marks'));

      await act(async () => {
        fireEvent.click(
          within(dialog).getByRole('button', { name: 'Disconnect' }),
        );
      });

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(disconnect).toHaveBeenCalledWith({ deleteWatchedMarks: true });
    });

    it('describes destroyed stores in the disconnect dialog', () => {
      renderConnected();
      const dialog = openDisconnectDialog();

      expect(dialog).toHaveTextContent(/Followed Channels/);
      expect(dialog).toHaveTextContent(/Cached Uploads/);
      expect(dialog).toHaveTextContent(/notification/);
      expect(dialog).toHaveTextContent(/digest/);
      expect(dialog).toHaveTextContent(/OAuth/);
    });

    it.each(['discovering', 'running'] as const)(
      'disables disconnect while upload sync status is %s and does not open confirm',
      (liveStatus) => {
        const disconnect = jest.fn();
        renderConnected(disconnect, {
          status: statusOf({ status: liveStatus }),
        });

        const disconnectBtn = screen.getByRole('button', {
          name: 'Disconnect unavailable while a sync is running',
        });
        expect(disconnectBtn).toBeDisabled();

        fireEvent.click(disconnectBtn);

        expect(
          screen.queryByRole('dialog', { name: 'Disconnect YouTube?' }),
        ).not.toBeInTheDocument();
        expect(disconnect).not.toHaveBeenCalled();
      },
    );

    it('disables disconnect while channel sync is discovering and does not open confirm', () => {
      const disconnect = jest.fn();
      renderConnected(disconnect, {
        status: statusOf({
          status: 'success',
          channelStatus: 'discovering',
        }),
      });

      const disconnectBtn = screen.getByRole('button', {
        name: 'Disconnect unavailable while a sync is running',
      });
      expect(disconnectBtn).toBeDisabled();

      fireEvent.click(disconnectBtn);

      expect(
        screen.queryByRole('dialog', { name: 'Disconnect YouTube?' }),
      ).not.toBeInTheDocument();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it('shows disconnect error alert inside the dialog when disconnect rejects', async () => {
      const disconnect = jest
        .fn()
        .mockRejectedValue(new Error('Server unavailable'));
      renderConnected(disconnect);
      const dialog = openDisconnectDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Disconnect' }),
      );

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(
          'Server unavailable',
        );
      });
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it('surfaces sync_run_live YouTubeRequestError message inside the dialog', async () => {
      const { YouTubeRequestError } = jest.requireMock('../hooks') as {
        YouTubeRequestError: new (
          message: string,
          status: number,
          code?: string,
        ) => Error;
      };
      const disconnect = jest
        .fn()
        .mockRejectedValue(
          new YouTubeRequestError(
            'Disconnect is not available while a sync is in progress.',
            409,
            'sync_run_live',
          ),
        );
      renderConnected(disconnect);
      const dialog = openDisconnectDialog();

      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Disconnect' }),
      );

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(
          'Disconnect is not available while a sync is in progress.',
        );
      });
    });
  });
});
