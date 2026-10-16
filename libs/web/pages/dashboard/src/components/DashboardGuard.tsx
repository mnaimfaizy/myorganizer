'use client';

import {
  authSession,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganiser/auth';
import {
  ServerUnreachableNotice,
  useRetryOnReconnect,
} from '@myorganiser/web-ui';
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface DashboardGuardProps {
  children: ReactNode;
}

type GuardState = 'checking' | 'ready' | 'unavailable';

export default function DashboardGuard(props: DashboardGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>('checking');
  const [retrying, setRetrying] = useState(false);
  // Bumped by a retry. Each bump re-runs the outbound check below.
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuthenticated() {
      const outcome = await resolveOutboundGuard(authSession);
      inFlightRef.current = false;
      setRetrying(false);

      if (cancelled) return;

      if (outcome.kind === 'allow') {
        setState('ready');
      } else if (outcome.kind === 'redirect_login') {
        setState('checking');
        router.replace('/login');
      } else {
        setState('unavailable');
      }
    }

    void ensureAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  const retry = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRetrying(true);
    setAttempt((count) => count + 1);
  }, []);

  useRetryOnReconnect(state === 'unavailable', retry);

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
