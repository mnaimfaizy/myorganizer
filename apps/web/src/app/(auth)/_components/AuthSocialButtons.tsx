'use client';

import { Button } from '@myorganizer/web-ui';

export type AuthSocialProvider = 'facebook' | 'google' | 'twitter' | 'apple';

type AuthSocialButtonsProps = {
  providers: readonly AuthSocialProvider[];
  onProviderClick: (provider: AuthSocialProvider) => void;
};

const PROVIDER_LABEL: Record<AuthSocialProvider, string> = {
  facebook: 'Facebook',
  google: 'Google',
  twitter: 'X (Twitter)',
  apple: 'Apple',
};

/**
 * Icon-only SSO stubs. Brand SVGs inline (no extra dependency);
 * labels via aria-label for accessibility.
 */
export function AuthSocialButtons({
  providers,
  onProviderClick,
}: AuthSocialButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          onClick={() => onProviderClick(provider)}
          className="h-11 w-full"
          aria-label={`Continue with ${PROVIDER_LABEL[provider]}`}
        >
          <SocialIcon provider={provider} />
        </Button>
      ))}
    </div>
  );
}

function SocialIcon({ provider }: { provider: AuthSocialProvider }) {
  switch (provider) {
    case 'facebook':
      return (
        <svg
          className="h-5 w-5 text-[#1877F2]"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'google':
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
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
      );
    case 'twitter':
      return (
        <svg
          className="h-5 w-5 text-foreground"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'apple':
      return (
        <svg
          className="h-5 w-5 text-foreground"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M16.365 1.43c0 1.14-.45 2.2-1.19 3.06-.78.92-2.09 1.63-3.33 1.54-.16-1.18.47-2.4 1.18-3.21.78-.88 2.13-1.55 3.34-1.39z" />
          <path d="M20.52 17.2c-.58 1.34-1.3 2.57-2.33 3.86-1.18 1.47-2.15 2.49-3.54 2.52-1.36.03-1.79-.86-3.52-.86-1.74 0-2.21.83-3.51.89-1.34.06-2.37-1.13-3.56-2.6C2.12 18.03.7 13.1 2.75 9.6c1.02-1.74 2.84-2.84 4.82-2.87 1.32-.03 2.56.92 3.52.92.95 0 2.73-1.14 4.6-.97.78.03 2.98.32 4.39 2.42-.11.07-2.62 1.53-2.59 4.56.03 3.61 3.16 4.81 3.19 4.82z" />
        </svg>
      );
    default:
      return null;
  }
}
