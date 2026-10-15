import { AppLogo } from '@myorganizer/web-ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AUTH_HERO_COPY, type AuthHeroScreen } from './authHero';
import { AuthHeroPlaceholder } from './AuthHeroPlaceholder';

export type AuthSplitShellProps = {
  screen: AuthHeroScreen;
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** Optional control above the title (e.g. back to login). */
  beforeTitle?: ReactNode;
  /** Optional content below the main children (SSO, etc.). */
  footer?: ReactNode;
  showLogo?: boolean;
  formMaxWidthClassName?: string;
};

/**
 * Option A auth layout: form left / hero right.
 * Scoped fonts + purple primary come from `(auth)/layout.tsx`.
 */
export function AuthSplitShell({
  screen,
  title,
  description,
  children,
  beforeTitle,
  footer,
  showLogo = true,
  formMaxWidthClassName = 'max-w-md',
}: AuthSplitShellProps) {
  const hero = AUTH_HERO_COPY[screen];

  return (
    <div className="flex min-h-screen bg-[var(--color-surface,#F8FAFC)]">
      <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2 lg:px-12">
        <div className={`w-full space-y-6 ${formMaxWidthClassName}`}>
          {showLogo ? <AppLogo variant="full" height={34} /> : null}
          {beforeTitle}
          <div>
            <h1
              className="text-3xl font-bold tracking-tight text-[var(--color-primary,#0F172A)]"
              style={{
                fontFamily:
                  'var(--font-auth-display), ui-sans-serif, system-ui',
              }}
            >
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted,#64748B)]">
              {description}
            </p>
          </div>
          {children}
          {footer}
        </div>
      </div>

      <div className="relative hidden p-8 lg:flex lg:w-1/2 lg:flex-col lg:justify-center">
        <div className="mb-6 max-w-md">
          <h2
            className="text-2xl font-bold text-[var(--color-primary,#0F172A)]"
            style={{
              fontFamily: 'var(--font-auth-display), ui-sans-serif, system-ui',
            }}
          >
            {hero.title}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted,#64748B)]">
            {hero.subtitle}
          </p>
        </div>
        <AuthHeroPlaceholder screen={screen} className="min-h-[420px]" />
      </div>
    </div>
  );
}

/** Text link style for auth cross-links (uses scoped primary = purple). */
export function AuthTextLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`font-medium text-primary hover:underline underline-offset-2 ${className}`}
    >
      {children}
    </Link>
  );
}
