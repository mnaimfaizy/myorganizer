'use client';

import { getApiBaseUrl } from '@myorganizer/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type VerifyState =
  | { status: 'idle' | 'verifying' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [state, setState] = useState<VerifyState>({ status: 'idle' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'Missing token.' });
      return;
    }

    let cancelled = false;

    async function run() {
      setState({ status: 'verifying' });
      try {
        const res = await fetch(`${apiBase}/auth/verify/email`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          let message = 'Failed to verify email.';
          try {
            const data = (await res.json()) as any;
            if (typeof data?.message === 'string') message = data.message;
          } catch {
            // ignore
          }

          if (!cancelled) setState({ status: 'error', message });
          return;
        }

        if (!cancelled) setState({ status: 'success' });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to verify.';
        if (!cancelled) setState({ status: 'error', message });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Verify your email</h1>

        {state.status === 'idle' || state.status === 'verifying' ? (
          <p className="text-muted-foreground">Verifying…</p>
        ) : null}

        {state.status === 'success' ? (
          <>
            <p className="text-muted-foreground">
              Your email has been verified. You can now log in.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Go to login
            </Link>
          </>
        ) : null}

        {state.status === 'error' ? (
          <>
            <p className="text-muted-foreground">{state.message}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Go to login
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
