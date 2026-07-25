'use client';

import { login, resendVerificationEmail } from '@myorganizer/auth';
import { Button, Checkbox, Input, Label, useToast } from '@myorganizer/web-ui';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { AuthSplitShell, AuthTextLink } from '../_components/AuthSplitShell';
import {
  AuthSocialButtons,
  type AuthSocialProvider,
} from '../_components/AuthSocialButtons';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setEmailNotVerified(false);
    try {
      await login({ email, password, rememberMe });
      toast({ title: 'Logged in' });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';

      if (message.toLowerCase().includes('email not verified')) {
        setEmailNotVerified(true);
        toast({
          title: 'Email not verified',
          description: 'Please verify your email before logging in.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSSOLogin = (provider: AuthSocialProvider) => {
    // TODO: Implement SSO login logic
    console.log('SSO Login with:', provider);
  };

  const handleResendVerification = async () => {
    if (!email) return;
    if (isResendingVerification) return;

    setIsResendingVerification(true);
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
      setIsResendingVerification(false);
    }
  };

  return (
    <AuthSplitShell
      screen="login"
      title="Login"
      description="Sign in to access your MyOrganiser account."
      footer={
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[var(--color-surface,#F8FAFC)] px-2 text-muted-foreground">
                Or login with
              </span>
            </div>
          </div>
          <AuthSocialButtons
            providers={['facebook', 'google', 'twitter']}
            onProviderClick={handleSSOLogin}
          />
        </div>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {emailNotVerified ? (
          <div className="rounded-lg border border-border bg-muted/60 p-3 text-sm text-foreground">
            <div className="font-medium">Email not verified</div>
            <div className="mt-1 text-muted-foreground">
              Check your inbox for the verification email and click the link
              inside.
              {email ? (
                <>
                  {' '}
                  You can also visit{' '}
                  <AuthTextLink
                    href={`/verify/email/sent?email=${encodeURIComponent(email)}`}
                  >
                    the verification instructions page
                  </AuthTextLink>
                  .
                </>
              ) : null}
            </div>
            {email ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isResendingVerification}
                  onClick={handleResendVerification}
                >
                  Resend verification email
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pr-10"
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

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            />
            <Label htmlFor="remember" className="cursor-pointer font-normal">
              Remember me
            </Label>
          </div>
          <AuthTextLink href="/forgot-password" className="text-sm">
            Forgot password?
          </AuthTextLink>
        </div>

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
          {isSubmitting ? 'Logging in…' : 'Login'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <AuthTextLink href="/signup">Sign up</AuthTextLink>
        </p>
      </form>
    </AuthSplitShell>
  );
}
