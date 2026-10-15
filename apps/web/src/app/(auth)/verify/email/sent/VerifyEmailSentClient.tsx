'use client';

import { resendVerificationEmail } from '@myorganizer/auth';
import { Button, useToast } from '@myorganizer/web-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AuthSplitShell } from '../../../_components/AuthSplitShell';

export default function VerifyEmailSentClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    if (isResending) return;
    setIsResending(true);
    try {
      const res = await resendVerificationEmail(email);
      toast({
        title: 'Verification email sent',
        description: res.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.';
      toast({
        title: 'Could not resend verification email',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthSplitShell
      screen="check-email"
      title="Check your email"
      description={
        <>
          We&apos;ve sent a verification email
          {email ? (
            <>
              {' '}
              to <span className="font-medium text-foreground">{email}</span>
            </>
          ) : null}
          . Open the link inside to verify your account.
        </>
      }
      beforeTitle={
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      }
    >
      <div className="space-y-3">
        <Button asChild className="h-11 w-full">
          <Link href="/login">Go to login</Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!email || isResending}
          onClick={handleResend}
          className="h-11 w-full"
        >
          {isResending ? 'Sending…' : 'Resend verification email'}
        </Button>
      </div>
    </AuthSplitShell>
  );
}
