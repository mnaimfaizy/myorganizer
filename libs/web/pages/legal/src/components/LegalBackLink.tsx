'use client';

import { Button } from '@myorganiser/web-ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent, useCallback } from 'react';

/**
 * True when the previous history entry is plausibly an earlier page of this
 * app: there is one, and the document referrer is same-origin. Otherwise the
 * link falls through to its href (`/`).
 */
function canReturnInApp(): boolean {
  if (window.history.length <= 1) return false;
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Back control shown at the top of the standalone legal pages. Goes back to the
 * previous in-app page when there is one; otherwise navigates to Home.
 */
export function LegalBackLink() {
  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!canReturnInApp()) return;
    event.preventDefault();
    window.history.back();
  }, []);

  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href="/" onClick={handleClick}>
        <ChevronLeft aria-hidden="true" />
        Back
      </Link>
    </Button>
  );
}
