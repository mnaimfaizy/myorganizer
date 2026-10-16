'use client';

import { authSession, resolveInboundGuard } from '@myorganiser/auth';
import { useRetryOnReconnect } from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type GateState = 'checking' | 'redirecting' | 'guest' | 'unavailable';

interface RootAuthRedirectProps {
  children: ReactNode;
}

export default function RootAuthRedirect(props: RootAuthRedirectProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');
  // Bumped by a retry. Each bump re-runs the inbound check below.
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const outcome = await resolveInboundGuard(authSession);
      inFlightRef.current = false;

      if (outcome.kind === 'redirect_dashboard') {
        if (!cancelled) setState('redirecting');
        router.replace('/dashboard');
      } else if (outcome.kind === 'show_guest') {
        if (!cancelled) setState('guest');
      } else if (!cancelled) {
        setState('unavailable');
      }
    }

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  const retry = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setAttempt((count) => count + 1);
  }, []);

  // The landing page stays visible while the restore is unavailable; the
  // restore is retried when the connection or focus returns.
  useRetryOnReconnect(state === 'unavailable', retry);

  // Guests and restore-unavailable Sessions both see the landing page.
  if (state !== 'guest' && state !== 'unavailable') return null;

  return props.children;
}
