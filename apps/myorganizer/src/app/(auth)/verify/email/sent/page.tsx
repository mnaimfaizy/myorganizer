'use client';

import { resendVerificationEmail } from '@myorganizer/auth';
import { Button, useToast } from '@myorganizer/web-ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function VerifyEmailSentPage() {
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground">
          We’ve sent a verification email{email ? ` to ${email}` : ''}. Please
          click the link in that email to verify your account.
        </p>
        <p className="text-muted-foreground">
          After verifying, come back and log in.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Go to login
          </Link>

          <Button
            type="button"
            variant="secondary"
            disabled={!email || isResending}
            onClick={handleResend}
          >
            Resend verification email
          </Button>
        </div>
      </div>
    </div>
  );
}
