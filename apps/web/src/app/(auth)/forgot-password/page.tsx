'use client';

import { requestPasswordReset } from '@myorganizer/auth';
import { Button, Input, Label, useToast } from '@myorganizer/web-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { AuthSplitShell } from '../_components/AuthSplitShell';

export default function ForgotPasswordPage() {
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset({ email });
      toast({
        title: 'Check your email',
        description: res.message,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.';
      toast({
        title: 'Could not send reset email',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitShell
      screen="forgot"
      title="Forgot your password?"
      description="Don't worry — it happens. Enter your email and we'll send a reset link."
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane.doe@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthSplitShell>
  );
}
