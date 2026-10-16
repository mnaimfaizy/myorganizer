'use client';

import {
  authSession,
  getCurrentUser,
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

import { isPlatformAdmin } from '../lib/isPlatformAdmin';

interface AdminGuardProps {
  children: ReactNode;
}

type GuardState = 'checking' | 'ready' | 'unavailable';

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>('checking');
  const [retrying, setRetrying] = useState(false);
  // Bumped by a retry. Each bump re-runs the outbound check below.
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function ensurePlatformAdmin() {
      const outcome = await resolveOutboundGuard(authSession);
      inFlightRef.current = false;
      setRetrying(false);

      if (cancelled) return;

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
    }

    void ensurePlatformAdmin();

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

  return children;
}
