'use client';

import { confirmPasswordReset } from '@myorganizer/auth';
import { Button, Input, Label, useToast } from '@myorganizer/web-ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

function RightIllustration() {
  return (
    <div className="hidden lg:flex w-1/2 items-center justify-center p-8 bg-background">
      <div className="w-full max-w-xl h-[520px] rounded-3xl bg-muted border border-border flex items-center justify-center overflow-hidden">
        <div className="w-full h-full flex items-center justify-center p-10">
          <svg
            viewBox="0 0 420 340"
            className="w-full max-w-[420px] h-auto"
            role="img"
            aria-label="Set a new password illustration"
          >
            {/* Card */}
            <rect
              x="70"
              y="120"
              width="280"
              height="170"
              rx="28"
              className="fill-background"
              stroke="currentColor"
              opacity="0.12"
            />

            {/* Lock body */}
            <g className="text-blue-600">
              <rect
                x="168"
                y="70"
                width="84"
                height="78"
                rx="18"
                fill="currentColor"
                opacity="0.95"
              />
              <path
                d="M186 70v-10c0-18 12-30 24-30s24 12 24 30v10"
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.75"
              />
              <circle cx="210" cy="108" r="7" fill="white" opacity="0.9" />
              <path
                d="M210 115v16"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>

            {/* Password field */}
            <rect
              x="120"
              y="180"
              width="180"
              height="34"
              rx="10"
              className="fill-muted"
            />
            <rect
              x="130"
              y="190"
              width="70"
              height="14"
              rx="7"
              className="fill-background"
              opacity="0.55"
            />

            {/* Dots */}
            <g className="text-blue-600" opacity="0.85">
              <circle cx="225" cy="197" r="5" fill="currentColor" />
              <circle cx="242" cy="197" r="5" fill="currentColor" />
              <circle cx="259" cy="197" r="5" fill="currentColor" />
              <circle cx="276" cy="197" r="5" fill="currentColor" />
            </g>

            {/* Button */}
            <rect
              x="120"
              y="230"
              width="180"
              height="34"
              rx="10"
              className="fill-background"
              opacity="0.5"
            />
            <rect
              x="155"
              y="243"
              width="110"
              height="8"
              rx="4"
              className="fill-muted"
            />

            {/* Decorative */}
            <g className="text-muted-foreground" opacity="0.35">
              <circle cx="330" cy="150" r="10" fill="currentColor" />
              <circle cx="352" cy="175" r="6" fill="currentColor" />
            </g>

            <g className="text-muted-foreground" opacity="0.45">
              <rect
                x="90"
                y="150"
                width="44"
                height="32"
                rx="8"
                fill="currentColor"
                opacity="0.25"
              />
              <path
                d="M92 156l20 14 20-14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </g>

            <g className="text-muted-foreground" opacity="0.45">
              <circle
                cx="105"
                cy="260"
                r="14"
                fill="currentColor"
                opacity="0.22"
              />
              <path
                d="M117 260h55l10 10h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M165 260v-12"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="min-h-screen flex">
      {/* Left side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-2xl font-bold">Your Logo</span>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Set a password
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Your previous password has been reseted. Please set a new
                password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Create Password
                </Label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Re-enter Password
                </Label>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

              <Button
                type="submit"
                disabled={isSubmitting || isTokenMissing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                {isSubmitting ? 'Setting password…' : 'Set password'}
              </Button>

              {isTokenMissing ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Invalid reset link. Please{' '}
                  <Link
                    href="/forgot-password"
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
                  >
                    request a new reset email
                  </Link>
                  .
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </div>

      {/* Right side */}
      <RightIllustration />
    </div>
  );
}
