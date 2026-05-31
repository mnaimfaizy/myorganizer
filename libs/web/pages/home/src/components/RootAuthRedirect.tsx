'use client';

import {
  clearAuthSession,
  getAccessToken,
  getCurrentUser,
  refresh,
} from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

type GateState = 'checking' | 'redirecting' | 'guest';

export default function RootAuthRedirect(props: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const token = getAccessToken();
      if (token) {
        if (!cancelled) setState('redirecting');
        router.replace('/dashboard');
        return;
      }

      const storedUser = getCurrentUser();
      if (!storedUser) {
        if (!cancelled) setState('guest');
        return;
      }

      try {
        await refresh();
        if (cancelled) return;
        setState('redirecting');
        router.replace('/dashboard');
      } catch {
        clearAuthSession();
        if (!cancelled) setState('guest');
      }
    }

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== 'guest') return null;

  return props.children;
}
