'use client';

import { authSession, resolveInboundGuard } from '@myorganiser/auth';
import { useRetryableCheck } from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useState } from 'react';

type GateState = 'checking' | 'redirecting' | 'guest' | 'unavailable';

interface RootAuthRedirectProps {
  children: ReactNode;
}

export default function RootAuthRedirect(props: RootAuthRedirectProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  const handleOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof resolveInboundGuard>>) => {
      if (outcome.kind === 'redirect_dashboard') {
        setState('redirecting');
        router.replace('/dashboard');
      } else if (outcome.kind === 'show_guest') {
        setState('guest');
      } else {
        setState('unavailable');
      }
    },
    [router],
  );

  // The landing page stays visible while the restore is unavailable; the
  // restore is retried when the connection or focus returns.
  useRetryableCheck(() => resolveInboundGuard(authSession), handleOutcome, {
    retryOnReconnect: state === 'unavailable',
  });

  // Guests and restore-unavailable Sessions both see the landing page.
  if (state !== 'guest' && state !== 'unavailable') return null;

  return props.children;
}
