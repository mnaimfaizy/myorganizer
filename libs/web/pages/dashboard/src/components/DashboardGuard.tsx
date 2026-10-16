'use client';

import {
  authSession,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganiser/auth';
import {
  ServerUnreachableNotice,
  useRetryableCheck,
} from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

interface DashboardGuardProps {
  children: ReactNode;
}

type GuardState = 'checking' | 'ready' | 'unavailable';

export default function DashboardGuard(props: DashboardGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>('checking');

  const handleOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof resolveOutboundGuard>>) => {
      if (outcome.kind === 'allow') {
        setState('ready');
      } else if (outcome.kind === 'redirect_login') {
        setState('checking');
        router.replace('/login');
      } else {
        setState('unavailable');
      }
    },
    [router],
  );

  const { retry, retrying } = useRetryableCheck(
    () => resolveOutboundGuard(authSession),
    handleOutcome,
    { retryOnReconnect: state === 'unavailable' },
  );

  // Once the shell is shown or the server is unreachable, a Session ended by a
  // refused refresh or by another window signing out must stop the shell
  // rendering before the router navigates away.
  useEffect(() => {
    if (state === 'checking') return undefined;

    return onSessionEnded(() => {
      setState('checking');
      router.replace('/login');
    });
  }, [state, router]);

  if (state === 'unavailable') {
    return <ServerUnreachableNotice onRetry={retry} retrying={retrying} />;
  }

  if (state !== 'ready') return null;

  return props.children;
}
