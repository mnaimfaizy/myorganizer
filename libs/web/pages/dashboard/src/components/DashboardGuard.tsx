'use client';

import { clearAuthSession, getAccessToken, refresh } from '@myorganizer/auth';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

export default function DashboardGuard(props: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuthenticated() {
      const token = getAccessToken();
      if (token) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        await refresh();
        if (!cancelled) setReady(true);
      } catch {
        clearAuthSession();
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
