'use client';

import { requestPasswordReset } from '@myorganizer/auth';
import { Button, Input, Label, useToast } from '@myorganizer/web-ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleSSOLogin = (provider: string) => {
    // TODO: Implement SSO login logic
    // eslint-disable-next-line no-console
    console.log('SSO Login with:', provider);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Forgot Password Form */}
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>

            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Forgot your password?
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Don&apos;t worry, happens to all of us. Enter your email below
                to recover your password
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-gray-500 dark:text-gray-400">
                  Or login with
                </span>
              </div>
            </div>

            {/* SSO Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSSOLogin('facebook')}
                className="flex items-center justify-center h-11"
              >
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleSSOLogin('google')}
                className="flex items-center justify-center h-11"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleSSOLogin('apple')}
                className="flex items-center justify-center h-11"
              >
                <svg
                  className="w-5 h-5 text-gray-900 dark:text-gray-100"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M16.365 1.43c0 1.14-.45 2.2-1.19 3.06-.78.92-2.09 1.63-3.33 1.54-.16-1.18.47-2.4 1.18-3.21.78-.88 2.13-1.55 3.34-1.39z" />
                  <path d="M20.52 17.2c-.58 1.34-1.3 2.57-2.33 3.86-1.18 1.47-2.15 2.49-3.54 2.52-1.36.03-1.79-.86-3.52-.86-1.74 0-2.21.83-3.51.89-1.34.06-2.37-1.13-3.56-2.6C2.12 18.03.7 13.1 2.75 9.6c1.02-1.74 2.84-2.84 4.82-2.87 1.32-.03 2.56.92 3.52.92.95 0 2.73-1.14 4.6-.97.78.03 2.98.32 4.39 2.42-.11.07-2.62 1.53-2.59 4.56.03 3.61 3.16 4.81 3.19 4.82z" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-xl h-[520px] rounded-3xl bg-muted border border-border flex items-center justify-center overflow-hidden">
          <div className="w-full h-full flex items-center justify-center p-10">
            <svg
              viewBox="0 0 420 340"
              className="w-full max-w-[420px] h-auto"
              role="img"
              aria-label="Password recovery illustration"
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

              {/* Decorative gear dots */}
              <g className="text-muted-foreground" opacity="0.35">
                <circle cx="330" cy="150" r="10" fill="currentColor" />
                <circle cx="352" cy="175" r="6" fill="currentColor" />
              </g>

              {/* Small envelope */}
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

              {/* Key */}
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
    </div>
  );
}
