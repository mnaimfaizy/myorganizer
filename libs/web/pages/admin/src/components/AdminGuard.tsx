'use client';

import {
  authSession,
  getCurrentUser,
  onSessionEnded,
  resolveOutboundGuard,
} from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { isPlatformAdmin } from '../lib/isPlatformAdmin';

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensurePlatformAdmin() {
      const outcome = await resolveOutboundGuard(authSession);

      if (outcome.kind === 'redirect_login') {
        if (!cancelled) router.replace('/login');
        return;
      }

      if (outcome.kind === 'allow') {
        const user = getCurrentUser();

        if (isPlatformAdmin(user)) {
          if (!cancelled) setReady(true);
        } else if (!cancelled) {
          router.replace('/dashboard');
        }
      }
    }

    void ensurePlatformAdmin();

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

  return children;
}
