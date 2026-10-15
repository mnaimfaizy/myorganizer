import { Toaster } from '@myorganizer/web-ui';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Auth route chrome. Visual system: Option A (see DECISION.md).
 * Purple --primary is scoped here so dashboard/app chrome is unchanged.
 */
const authDisplay = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-auth-display',
  display: 'swap',
});

const authBody = Inter({
  subsets: ['latin'],
  variable: '--font-auth-body',
  display: 'swap',
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  const style = {
    // Token secondary #7C3AED → HSL for shadcn Button/Link primary
    '--primary': '262.1 83.3% 57.8%',
    '--primary-foreground': '0 0% 100%',
    fontFamily: 'var(--font-auth-body), ui-sans-serif, system-ui',
  } as CSSProperties;

  return (
    <div
      className={`${authDisplay.variable} ${authBody.variable}`}
      style={style}
    >
      {children}
      <Toaster />
    </div>
  );
}
