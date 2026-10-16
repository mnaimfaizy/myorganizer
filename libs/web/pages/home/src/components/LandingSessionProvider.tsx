'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * What the landing page offers this visitor. `guest` shows the sign-in and
 * sign-up entry points. `session_kept` means the client holds a Restorable
 * Session that the server could not confirm, so the landing page offers the
 * dashboard instead of a sign-in prompt (CONTEXT.md: Restorable Session).
 */
export type LandingSessionView = 'guest' | 'session_kept';

// Private: consumers read the view through useLandingSessionView(). The
// default keeps LandingContent rendered without a provider behaving as a guest.
const LandingSessionContext = createContext<LandingSessionView>('guest');

interface LandingSessionProviderProps {
  view: LandingSessionView;
  children: ReactNode;
}

export function LandingSessionProvider({
  view,
  children,
}: LandingSessionProviderProps) {
  return (
    <LandingSessionContext.Provider value={view}>
      {children}
    </LandingSessionContext.Provider>
  );
}

/** The landing session view, or `guest` when no provider is mounted. */
export function useLandingSessionView(): LandingSessionView {
  return useContext(LandingSessionContext);
}
