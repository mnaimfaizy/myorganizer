import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { RetryableGate, type GateDecision } from './RetryableGate';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('RetryableGate', () => {
  // Each check call records its own deferred so a test settles calls one at a time.
  let pending: Deferred<GateDecision>[];

  function createCheck() {
    return jest.fn(() => {
      const deferred = createDeferred<GateDecision>();
      pending.push(deferred);
      return deferred.promise;
    });
  }

  async function settle(index: number, decision: GateDecision) {
    await act(async () => {
      pending[index].resolve(decision);
    });
  }

  beforeEach(() => {
    pending = [];
  });

  it('renders nothing while the check is pending', () => {
    const check = createCheck();
    const navigate = jest.fn();

    const { container } = render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    expect(check).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('shell')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders children when the check allows', async () => {
    const check = createCheck();
    const navigate = jest.fn();

    render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    await settle(0, { kind: 'allow' });

    expect(await screen.findByText('shell')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates to the redirect target and renders nothing', async () => {
    const check = createCheck();
    const navigate = jest.fn();

    const { container } = render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    await settle(0, { kind: 'redirect', to: '/login' });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login');
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('shell')).not.toBeInTheDocument();
  });

  it('shows the unreachable notice without children when the check is unavailable', async () => {
    const check = createCheck();
    const navigate = jest.fn();

    render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    await settle(0, { kind: 'unavailable' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByText('shell')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Try again re-runs the check and renders children once it allows', async () => {
    const check = createCheck();
    const navigate = jest.fn();

    render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );
    await settle(0, { kind: 'unavailable' });

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(check).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();

    await settle(1, { kind: 'allow' });

    expect(await screen.findByText('shell')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('re-runs the check when the browser comes back online while unavailable', async () => {
    const check = createCheck();
    const navigate = jest.fn();

    render(
      <RetryableGate check={check} navigate={navigate}>
        <div>shell</div>
      </RetryableGate>,
    );
    await settle(0, { kind: 'unavailable' });
    await screen.findByRole('alert');

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(check).toHaveBeenCalledTimes(2);

    await settle(1, { kind: 'allow' });

    expect(await screen.findByText('shell')).toBeInTheDocument();
  });

  it.each<[string, GateDecision]>([
    ['ready', { kind: 'allow' }],
    ['unavailable', { kind: 'unavailable' }],
  ])(
    'subscribes to session end only once the gate is %s, not while checking',
    async (_state, decision) => {
      const check = createCheck();
      const navigate = jest.fn();
      const unsubscribe = jest.fn();
      const subscribeToEnd = jest.fn(() => unsubscribe);

      render(
        <RetryableGate
          check={check}
          navigate={navigate}
          subscribeToEnd={subscribeToEnd}
          endedRedirect="/login"
        >
          <div>shell</div>
        </RetryableGate>,
      );

      expect(subscribeToEnd).not.toHaveBeenCalled();

      await settle(0, decision);

      await waitFor(() => {
        expect(subscribeToEnd).toHaveBeenCalledTimes(1);
      });
    },
  );

  it.each<[string, GateDecision, () => HTMLElement]>([
    ['ready', { kind: 'allow' }, () => screen.getByText('shell')],
    ['unavailable', { kind: 'unavailable' }, () => screen.getByRole('alert')],
  ])(
    'hides the %s gate and navigates to endedRedirect when the session ends',
    async (_state, decision, visibleContent) => {
      const check = createCheck();
      const navigate = jest.fn();
      let endListener: (() => void) | undefined;
      const subscribeToEnd = jest.fn((onEnd: () => void) => {
        endListener = onEnd;
        return jest.fn();
      });

      render(
        <RetryableGate
          check={check}
          navigate={navigate}
          subscribeToEnd={subscribeToEnd}
          endedRedirect="/login"
        >
          <div>shell</div>
        </RetryableGate>,
      );
      await settle(0, decision);
      await waitFor(() => {
        expect(subscribeToEnd).toHaveBeenCalledTimes(1);
      });
      expect(visibleContent()).toBeInTheDocument();

      act(() => {
        endListener?.();
      });

      expect(screen.queryByText('shell')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/login');
    },
  );

  it('calls the unsubscribe function returned by subscribeToEnd on unmount', async () => {
    const check = createCheck();
    const unsubscribe = jest.fn();
    const subscribeToEnd = jest.fn(() => unsubscribe);

    const { unmount } = render(
      <RetryableGate
        check={check}
        navigate={jest.fn()}
        subscribeToEnd={subscribeToEnd}
        endedRedirect="/login"
      >
        <div>shell</div>
      </RetryableGate>,
    );
    await settle(0, { kind: 'allow' });
    await screen.findByText('shell');
    expect(subscribeToEnd).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to session end when endedRedirect is undefined', async () => {
    const check = createCheck();
    const subscribeToEnd = jest.fn(() => jest.fn());

    render(
      <RetryableGate
        check={check}
        navigate={jest.fn()}
        subscribeToEnd={subscribeToEnd}
      >
        <div>shell</div>
      </RetryableGate>,
    );
    await settle(0, { kind: 'allow' });
    await screen.findByText('shell');

    expect(subscribeToEnd).not.toHaveBeenCalled();
  });

  it('navigates with the latest navigate prop after a rerender', async () => {
    const check = createCheck();
    const firstNavigate = jest.fn();
    const latestNavigate = jest.fn();

    const { rerender } = render(
      <RetryableGate check={check} navigate={firstNavigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    rerender(
      <RetryableGate check={check} navigate={latestNavigate}>
        <div>shell</div>
      </RetryableGate>,
    );

    await settle(0, { kind: 'redirect', to: '/dashboard' });

    await waitFor(() => {
      expect(latestNavigate).toHaveBeenCalledWith('/dashboard');
    });
    expect(firstNavigate).not.toHaveBeenCalled();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
