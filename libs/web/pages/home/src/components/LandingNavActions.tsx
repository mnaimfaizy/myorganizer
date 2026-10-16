'use client';

import { colorMuted, colorPrimary } from '@myorganiser/design-tokens';
import Link from 'next/link';

import { useLandingSessionView } from './LandingSessionProvider';

/**
 * Desktop auth links in the landing nav. A guest sees Login and Get Started;
 * a visitor holding a Restorable Session sees a single Open dashboard link.
 */
export function LandingNavActions() {
  const view = useLandingSessionView();

  if (view === 'session_kept') {
    return (
      <Link
        href="/dashboard"
        className="mo-btn-shimmer hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:inline-block"
        style={{ background: colorPrimary }}
      >
        Open dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="hidden text-sm font-semibold transition-colors hover:opacity-80 md:inline-block"
        style={{ color: colorMuted }}
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="mo-btn-shimmer hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:inline-block"
        style={{ background: colorPrimary }}
      >
        Get Started
      </Link>
    </>
  );
}
