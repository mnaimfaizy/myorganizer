'use client';

import { authSession, resolveOutboundGuard } from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

export default function DashboardGuard(props: { children: ReactNode }) {
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

  if (!ready) return null;

  return props.children;
}
