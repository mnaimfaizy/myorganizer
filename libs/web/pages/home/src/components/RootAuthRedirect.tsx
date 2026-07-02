'use client';

import { authSession, resolveInboundGuard } from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

type GateState = 'checking' | 'redirecting' | 'guest';

export default function RootAuthRedirect(props: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      const outcome = await resolveInboundGuard(authSession);

      if (outcome.kind === 'redirect_dashboard') {
        if (!cancelled) setState('redirecting');
        router.replace('/dashboard');
      } else if (outcome.kind === 'show_guest') {
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
