'use client';

import { getApiBaseUrl } from '@myorganizer/core';
import { Button } from '@myorganizer/web-ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AuthSplitShell } from '../../_components/AuthSplitShell';

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
      queueMicrotask(() => {
        setState({ status: 'error', message: 'Missing token.' });
      });
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
            const data = (await res.json()) as { message?: string };
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

  const title =
    state.status === 'success'
      ? 'Email verified'
      : state.status === 'error'
        ? 'Verification failed'
        : 'Verify your email';

  const description =
    state.status === 'idle' || state.status === 'verifying'
      ? 'Please wait while we confirm your email address.'
      : state.status === 'success'
        ? 'Your email is confirmed. You can sign in to MyOrganiser.'
        : state.status === 'error'
          ? state.message
          : '';

  return (
    <AuthSplitShell screen="verify" title={title} description={description}>
      {state.status === 'idle' || state.status === 'verifying' ? (
        <p className="text-sm text-muted-foreground">Verifying…</p>
      ) : null}

      {state.status === 'success' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-900">
            Success — your email address has been verified.
          </div>
          <Button asChild className="h-11 w-full">
            <Link href="/login">Continue to login</Link>
          </Button>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Button asChild className="h-11 w-full">
          <Link href="/login">Go to login</Link>
        </Button>
      ) : null}
    </AuthSplitShell>
  );
}
