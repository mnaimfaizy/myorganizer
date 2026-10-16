'use client';

import {
  authSession,
  getCurrentUser,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganiser/auth';
import {
  ServerUnreachableNotice,
  useRetryableCheck,
} from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { isPlatformAdmin } from '../lib/isPlatformAdmin';

interface AdminGuardProps {
  children: ReactNode;
}

type GuardState = 'checking' | 'ready' | 'unavailable';

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>('checking');

  const handleOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof resolveOutboundGuard>>) => {
      if (outcome.kind === 'redirect_login') {
        setState('checking');
        router.replace('/login');
        return;
      }

      if (outcome.kind === 'restore_unavailable') {
        setState('unavailable');
        return;
      }

      if (isPlatformAdmin(getCurrentUser())) {
        setState('ready');
      } else {
        setState('checking');
        router.replace('/dashboard');
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

  return children;
}
