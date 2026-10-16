'use client';

import * as React from 'react';

import { useRetryableCheck } from '../../hooks/use-retryable-check';
import { ServerUnreachableNotice } from '../ServerUnreachableNotice/ServerUnreachableNotice';

export type GateDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }
  | { kind: 'unavailable' };

export interface RetryableGateProps {
  /** Decides whether to show children; re-run on retry. Read via ref (latest). */
  check: () => Promise<GateDecision>;
  /** Performs a navigation (callers pass router.replace). Read via ref. */
  navigate: (to: string) => void;
  /**
   * Optional: subscribe to an external "access ended" signal while children or
   * the unreachable notice are shown; on signal, hide everything and navigate
   * to `endedRedirect`. Returns an unsubscribe.
   */
  subscribeToEnd?: (onEnd: () => void) => () => void;
  /** Destination when `subscribeToEnd` signals. Both props are required to subscribe. */
  endedRedirect?: string;
  children: React.ReactNode;
}

type GateState = 'checking' | 'ready' | 'unavailable';

/**
 * Gates children behind an asynchronous decision. While the decision is
 * pending nothing renders. An `unavailable` decision shows the unreachable
 * notice and retries on reconnect. A `redirect` decision navigates away.
 *
 * Once children or the notice are shown, an optional external end-of-access
 * signal hides everything and navigates to `endedRedirect`, before the router
 * navigates away.
 */
function RetryableGate({
  check,
  navigate,
  subscribeToEnd,
  endedRedirect,
  children,
}: RetryableGateProps) {
  const [state, setState] = React.useState<GateState>('checking');

  // Read through a ref so callers need not memoize `navigate`.
  const navigateRef = React.useRef(navigate);
  React.useEffect(() => {
    navigateRef.current = navigate;
  });

  const handleDecision = React.useCallback((decision: GateDecision) => {
    if (decision.kind === 'allow') {
      setState('ready');
    } else if (decision.kind === 'redirect') {
      setState('checking');
      navigateRef.current(decision.to);
    } else {
      setState('unavailable');
    }
  }, []);

  const { retry, retrying } = useRetryableCheck(check, handleDecision, {
    retryOnReconnect: state === 'unavailable',
  });

  // Once the shell is shown or the server is unreachable, a session that ends
  // must stop rendering before the router navigates away.
  React.useEffect(() => {
    if (
      state === 'checking' ||
      !subscribeToEnd ||
      endedRedirect === undefined
    ) {
      return undefined;
    }

    const to = endedRedirect;
    return subscribeToEnd(() => {
      setState('checking');
      navigateRef.current(to);
    });
  }, [state, subscribeToEnd, endedRedirect]);

  if (state === 'unavailable') {
    return <ServerUnreachableNotice onRetry={retry} retrying={retrying} />;
  }

  if (state !== 'ready') return null;

  return children;
}

export { RetryableGate };
