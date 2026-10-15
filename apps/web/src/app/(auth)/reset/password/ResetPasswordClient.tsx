'use client';

import { confirmPasswordReset } from '@myorganizer/auth';
import { Button, Input, Label, useToast } from '@myorganizer/web-ui';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { AuthSplitShell, AuthTextLink } from '../../_components/AuthSplitShell';

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTokenMissing = !token;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!token) {
      toast({
        title: 'Invalid reset link',
        description: 'Missing reset token. Please request a new reset email.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please re-enter the same password in both fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmPasswordReset({
        token,
        password,
        confirmPassword,
      });

      toast({ title: res.message });
      router.push('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.';
      toast({
        title: 'Could not reset password',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitShell
      screen="set-password"
      title="Set a password"
      description="Choose a strong password for your MyOrganiser account."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Create password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pr-10"
              disabled={isTokenMissing}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full pr-10"
              disabled={isTokenMissing}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={
                showConfirmPassword
                  ? 'Hide confirm password'
                  : 'Show confirm password'
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {isTokenMissing ? (
          <div className="rounded-lg border border-border bg-muted/60 p-3 text-sm">
            <div className="font-medium">Invalid reset link</div>
            <div className="mt-1 text-muted-foreground">
              Missing reset token. Please request a new reset email.
            </div>
            <div className="mt-2">
              <AuthTextLink href="/forgot-password">
                Go to forgot password
              </AuthTextLink>
            </div>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting || isTokenMissing}
          className="h-11 w-full"
        >
          {isSubmitting ? 'Saving…' : 'Save password'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <AuthTextLink href="/login">Login</AuthTextLink>
        </p>
      </form>
    </AuthSplitShell>
  );
}
