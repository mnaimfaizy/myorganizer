'use client';

import {
  authSession,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

interface DashboardGuardProps {
  children: ReactNode;
}

export default function DashboardGuard(props: DashboardGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuthenticated() {
      const outcome = await resolveOutboundGuard(authSession);

      if (outcome.kind === 'allow') {
        if (!cancelled) setReady(true);
      } else if (outcome.kind === 'redirect_login') {
        if (!cancelled) router.replace('/login');
      }
    }

    void ensureAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // The initial decision above runs once. Once children are rendered, a Session
  // ended by a refused refresh or by another window signing out must stop the
  // shell rendering before the router navigates away.
  useEffect(() => {
    if (!ready) return undefined;

    return onSessionEnded(() => {
      setReady(false);
      router.replace('/login');
    });
  }, [ready, router]);

  if (!ready) return null;

  return props.children;
}
